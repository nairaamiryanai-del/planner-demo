import { Redis } from '@upstash/redis';
import { VAPID_SUBJECT, VAPID_PUBLIC, PUSH_SEND_OPTS, getSubs, removeSub } from './_lib.js';

const redis = Redis.fromEnv();

// Отправляет тестовое уведомление на все устройства аккаунта.
export default async function handler(req, res) {
  const id = (req.query.id || '').toString();
  if (!/^[a-f0-9]{32,128}$/.test(id)) {
    return res.status(400).json({ error: 'invalid id' });
  }
  try {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, (process.env.VAPID_PRIVATE_KEY || '').trim());
    const subs = await getSubs(redis, id);
    if (subs.length === 0) {
      return res.status(404).json({ error: 'no devices subscribed' });
    }
    const payload = JSON.stringify({
      title: '🔔 Planner — проверка',
      body: 'Уведомления работают! Теперь напоминания будут приходить даже при закрытом приложении.',
      url: '/',
      tag: 'planner-test',
    });
    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, payload, PUSH_SEND_OPTS);
        sent++;
      } catch (e) {
        // 404/410 — подписка протухла, убираем её точечно
        if (e.statusCode === 404 || e.statusCode === 410) {
          await removeSub(redis, id, sub.endpoint);
        }
      }
    }
    return res.status(200).json({ sent });
  } catch (err) {
    console.error('push-test error:', err);
    return res.status(500).json({ error: 'send error' });
  }
}
