// Общий код серверных функций (файлы с «_» в /api не становятся эндпоинтами).

// VAPID-ключи для push-уведомлений задаются в переменных окружения (см. .env.example).
// Сгенерировать пару: npx web-push generate-vapid-keys
export const VAPID_SUBJECT = (process.env.VAPID_SUBJECT || 'mailto:you@example.com').trim();
export const VAPID_PUBLIC = (process.env.VAPID_PUBLIC_KEY || '').trim();

// Параметры отправки push: TTL 1 час, чтобы «через час: занятие» не приходило
// на следующий день, когда телефон снова выйдет в сеть (по умолчанию TTL 4 недели).
export const PUSH_SEND_OPTS = { TTL: 3600, urgency: 'high' };

const hashKey = (id) => `planner:pushh:${id}`;
const oldListKey = (id) => `planner:push:${id}`;

// Подписки хранятся в hash по endpoint: удаление и добавление отдельных устройств
// атомарны и не перезаписывают друг друга (в отличие от «прочитал список — записал список»).
export async function getSubs(redis, id) {
  const subs = await redis.hgetall(hashKey(id));
  if (subs && Object.keys(subs).length) return Object.values(subs);
  // Миграция со старого формата (весь список одним значением)
  const old = await redis.get(oldListKey(id));
  if (Array.isArray(old) && old.length) {
    const fields = {};
    for (const s of old) if (s && s.endpoint) fields[s.endpoint] = s;
    if (Object.keys(fields).length) {
      await redis.hset(hashKey(id), fields);
      await redis.del(oldListKey(id));
      return Object.values(fields);
    }
  }
  return [];
}

export function putSub(redis, id, sub) {
  return redis.hset(hashKey(id), { [sub.endpoint]: sub });
}

export function removeSub(redis, id, endpoint) {
  if (!endpoint) return Promise.resolve();
  return redis.hdel(hashKey(id), endpoint);
}

export function countSubs(redis, id) {
  return redis.hlen(hashKey(id));
}

// Разрешённые push-сервисы: не даём подписать сервер слать POST на произвольный адрес.
export function validPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false;
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname;
    return (
      h === 'fcm.googleapis.com' ||
      h === 'web.push.apple.com' || h.endsWith('.push.apple.com') ||
      h === 'updates.push.services.mozilla.com' || h.endsWith('.push.services.mozilla.com') ||
      h.endsWith('.notify.windows.com')
    );
  } catch {
    return false;
  }
}

export function parseBody(req) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return undefined;
  }
}
