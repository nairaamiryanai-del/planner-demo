import { Redis } from '@upstash/redis';
import { parseBody } from './_lib.js';

const redis = Redis.fromEnv();
const SCHED_KEY = 'planner:sched';
const DETAIL_KEY = 'planner:scheddetail';

const REPEAT_RE = /^(none|daily|weekly|monthly|yearly|m\d{1,2})$/;
const URL_RE = /^\/[a-z-]{0,40}$/;
const TZ_RE = /^[A-Za-z0-9_+\-/]{1,60}$/;
const MAX_FUTURE_MS = 3 * 366 * 24 * 3600 * 1000; // не дальше трёх лет вперёд
const MAX_ENTRIES = 5000;   // общий предохранитель на размер расписания
const MAX_BULK_ITEMS = 300;

// Проверка и нормализация одного элемента расписания.
// Возвращает { del, member } | { member, score, detail } | null (мусор — пропускаем).
function normalizeItem(id, raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  const reminderId = typeof raw.reminderId === 'string' ? raw.reminderId.slice(0, 120) : '';
  if (!reminderId) return null;
  const member = `${id}:${reminderId}`;

  if (raw.action === 'delete') return { del: true, member };

  const fireAt = raw.fireAt;
  if (typeof fireAt !== 'number' || !Number.isFinite(fireAt)) return null;
  if (fireAt > now + MAX_FUTURE_MS) return null;
  const repeat = REPEAT_RE.test(raw.repeat) ? raw.repeat : 'none';
  // Разовое срабатывание в прошлом не ставим, а удаляем: иначе «будильщик»
  // тут же пришлёт догоняющее уведомление о давно прошедшем событии.
  if (repeat === 'none' && fireAt < now - 60000) return { del: true, member };

  const repeatUntil = typeof raw.repeatUntil === 'number' && Number.isFinite(raw.repeatUntil) ? raw.repeatUntil : null;
  const detail = {
    accountId: id,
    reminderId,
    fireAt,
    title: String(raw.title || 'Напоминание').slice(0, 140),
    text: String(raw.text || '').slice(0, 300),
    repeat,
    repeatUntil,
    url: typeof raw.url === 'string' && URL_RE.test(raw.url) ? raw.url : '/reminders',
    tz: typeof raw.tz === 'string' && TZ_RE.test(raw.tz) ? raw.tz : null,
  };
  return { member, score: fireAt, detail };
}

// Расписание срабатываний для «будильщика». Хранится открыто (по согласию):
// отсортированное множество по времени + детали (заголовок/текст/повтор).
export default async function handler(req, res) {
  const id = (req.query.id || '').toString();
  if (!/^[a-f0-9]{32,128}$/.test(id)) {
    return res.status(400).json({ error: 'invalid id' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const body = parseBody(req);
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'invalid body' });

  try {
    const now = Date.now();
    let items;
    if (body.action === 'bulk') {
      if (!Array.isArray(body.items) || body.items.length > MAX_BULK_ITEMS) {
        return res.status(400).json({ error: 'invalid items' });
      }
      items = body.items.map((it) => normalizeItem(id, it, now)).filter(Boolean);
    } else {
      const one = normalizeItem(id, body, now);
      if (!one) return res.status(400).json({ error: 'invalid item' });
      items = [one];
    }

    // Сначала удаления, потом добавления: в пакете клиент шлёт «удалить старый
    // слот, поставить новый» для одного и того же элемента именно в этом порядке.
    const delMembers = [...new Set(items.filter((it) => it.del).map((it) => it.member))];
    const upserts = items.filter((it) => !it.del);

    if (delMembers.length) {
      await redis.zrem(SCHED_KEY, ...delMembers);
      await redis.hdel(DETAIL_KEY, ...delMembers);
    }
    if (upserts.length) {
      const total = await redis.zcard(SCHED_KEY);
      if (total > MAX_ENTRIES) return res.status(429).json({ error: 'schedule full' });
      await redis.zadd(SCHED_KEY, ...upserts.map((it) => ({ score: it.score, member: it.member })));
      await redis.hset(DETAIL_KEY, Object.fromEntries(upserts.map((it) => [it.member, it.detail])));
    }
    return res.status(200).json({ ok: true, upserted: upserts.length, deleted: delMembers.length });
  } catch (err) {
    console.error('schedule error:', err);
    return res.status(500).json({ error: 'schedule error' });
  }
}
