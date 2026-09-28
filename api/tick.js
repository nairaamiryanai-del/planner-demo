import { Redis } from '@upstash/redis';
import { VAPID_SUBJECT, VAPID_PUBLIC, PUSH_SEND_OPTS, getSubs, removeSub } from './_lib.js';

const redis = Redis.fromEnv();
const SCHED_KEY = 'planner:sched';
const DETAIL_KEY = 'planner:scheddetail';
// Секрет для вызова «будильщика» внешним планировщиком (QStash и т.п.) — только из окружения.
const TICK_SECRET = (process.env.TICK_SECRET || '').trim();

// ===== Календарная арифметика в часовом поясе пользователя =====
// Повторы считаем по местному календарю (пояс приходит с клиента), иначе
// месячные повторы «уезжают»: 31 января + месяц по UTC давало 3 марта.

function tzParts(ts, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(new Date(ts))) p[type] = value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

// Местные дата-время → unix ms (итеративная подгонка смещения пояса).
function utcFromParts(p, tz) {
  let ts = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  for (let i = 0; i < 3; i++) {
    const q = tzParts(ts, tz);
    const diff = Date.UTC(q.y, q.mo - 1, q.d, q.h, q.mi, q.s) - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    if (!diff) break;
    ts -= diff;
  }
  return ts;
}

const daysInMonth = (y, mo) => new Date(Date.UTC(y, mo, 0)).getUTCDate();

// Один шаг повтора по местному календарю. Месяцы с обрезкой дня, как addMonths
// на клиенте: 31 января + месяц = 28 февраля (а не 3 марта).
function stepParts(p, repeat) {
  const m = /^m(\d+)$/.exec(repeat || '');
  if (repeat === 'daily' || repeat === 'weekly') {
    const shift = repeat === 'daily' ? 1 : 7;
    const base = new Date(Date.UTC(p.y, p.mo - 1, p.d + shift));
    return { ...p, y: base.getUTCFullYear(), mo: base.getUTCMonth() + 1, d: base.getUTCDate() };
  }
  if (repeat === 'monthly' || m) {
    const months = m ? Number(m[1]) : 1;
    const total = (p.mo - 1) + months;
    const y = p.y + Math.floor(total / 12);
    const mo = (total % 12) + 1;
    return { ...p, y, mo, d: Math.min(p.d, daysInMonth(y, mo)) };
  }
  if (repeat === 'yearly') {
    const y = p.y + 1;
    return { ...p, y, d: Math.min(p.d, daysInMonth(y, p.mo)) };
  }
  return null;
}

function computeNext(detail) {
  const { fireAt, repeat, repeatUntil } = detail;
  if (!repeat || repeat === 'none') return null;
  let tz = detail.tz || 'UTC';
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); } catch { tz = 'UTC'; }
  const now = Date.now();
  let p = tzParts(fireAt, tz);
  let t = fireAt;
  let guard = 0;
  while (t <= now && guard < 1000) {
    const next = stepParts(p, repeat);
    if (!next) return null;
    p = next;
    t = utcFromParts(p, tz);
    guard++;
  }
  // Граница курса: после даты окончания больше не повторяем
  if (repeatUntil && t > repeatUntil) return null;
  return t;
}

// «Будильщик»: вызывается раз в несколько минут внешним планировщиком (QStash).
// Находит наступившие напоминания, шлёт push, повторяющиеся переносит на следующий раз.
export default async function handler(req, res) {
  if (!TICK_SECRET || (req.query.key || '') !== TICK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const now = Date.now();
    const due = await redis.zrange(SCHED_KEY, 0, now, { byScore: true });
    if (!due || due.length === 0) return res.status(200).json({ fired: 0 });

    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, (process.env.VAPID_PRIVATE_KEY || '').trim());

    let fired = 0;
    for (const member of due) {
      // «Забираем» задание атомарно: если два тика пересеклись, уведомление
      // отправит только тот, кому удалось удалить элемент из множества.
      const claimed = await redis.zrem(SCHED_KEY, member);
      if (!claimed) continue;

      const detail = await redis.hget(DETAIL_KEY, member);
      if (!detail) continue;

      const subs = await getSubs(redis, detail.accountId);
      const payload = JSON.stringify({
        title: detail.title || '🔔 Напоминание',
        body: detail.text || '',
        url: detail.url || '/reminders',
        tag: 'rem-' + detail.reminderId,
      });
      for (const sub of subs) {
        try {
          await webpush.sendNotification(sub, payload, PUSH_SEND_OPTS);
        } catch (e) {
          // 404/410 — подписка протухла, убираем только её (точечно, без гонок)
          if (e.statusCode === 404 || e.statusCode === 410) {
            await removeSub(redis, detail.accountId, sub.endpoint);
          }
        }
      }
      fired++;

      const next = computeNext(detail);
      if (next) {
        await redis.zadd(SCHED_KEY, { score: next, member });
        await redis.hset(DETAIL_KEY, { [member]: { ...detail, fireAt: next } });
      } else {
        await redis.hdel(DETAIL_KEY, member);
      }
    }
    return res.status(200).json({ fired });
  } catch (err) {
    console.error('tick error:', err);
    return res.status(500).json({ error: 'tick error' });
  }
}
