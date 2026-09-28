import { Redis } from '@upstash/redis';
import { parseBody, validPushEndpoint, putSub, removeSub, countSubs } from './_lib.js';

const redis = Redis.fromEnv();
const MAX_DEVICES = 10;

// Сохраняет push-подписку устройства. Подписки хранятся в hash по endpoint
// (planner:pushh:{accountId}) — у каждого устройства своя.
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

  // Новый формат: { subscription, oldEndpoint }; старый клиент шлёт подписку напрямую.
  const sub = body.subscription && typeof body.subscription === 'object' ? body.subscription : body;
  const oldEndpoint = typeof body.oldEndpoint === 'string' ? body.oldEndpoint : null;

  if (!validPushEndpoint(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return res.status(400).json({ error: 'invalid subscription' });
  }

  try {
    // Старая подписка этого устройства (после переподписки) больше не нужна
    if (oldEndpoint && oldEndpoint !== sub.endpoint) await removeSub(redis, id, oldEndpoint);
    const count = await countSubs(redis, id);
    if (count >= MAX_DEVICES) return res.status(429).json({ error: 'too many devices' });
    await putSub(redis, id, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
    const devices = await countSubs(redis, id);
    return res.status(200).json({ ok: true, devices });
  } catch (err) {
    console.error('push-subscribe error:', err);
    return res.status(500).json({ error: 'storage error' });
  }
}
