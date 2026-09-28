import { Redis } from '@upstash/redis';
import { parseBody } from './_lib.js';

const redis = Redis.fromEnv();
const MAX_BLOB_BYTES = 2 * 1024 * 1024; // предохранитель от мусорных записей

// Хранилище зашифрованных данных планировщика.
// Ключ в базе — planner:{accountId}, где accountId — хэш кодового слова (приходит с клиента).
// Сами данные клиент шифрует своим кодовым словом перед отправкой, поэтому здесь они нечитаемы.
export default async function handler(req, res) {
  const id = (req.query.id || '').toString();
  if (!/^[a-f0-9]{32,128}$/.test(id)) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const key = `planner:${id}`;

  try {
    if (req.method === 'GET') {
      const data = await redis.get(key);
      return res.status(200).json({ data: data || null });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (!body || typeof body.blob !== 'string' || body.blob.length > MAX_BLOB_BYTES) {
        return res.status(400).json({ error: 'invalid body' });
      }
      await redis.set(key, { blob: body.blob, updatedAt: Date.now() });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('sync error:', err);
    return res.status(500).json({ error: 'storage error' });
  }
}
