// Шифрование данных кодовым словом и синхронизация с облаком.
// Данные шифруются на устройстве (AES-GCM, ключ из кодового слова через PBKDF2),
// в облако уезжает только зашифрованный текст — прочитать его без слова нельзя.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Из кодового слова получаем идентификатор аккаунта (для ключа в базе)
// и ключ шифрования. Идентификатор и ключ выводятся по-разному, чтобы по id
// нельзя было восстановить ключ.
export async function deriveAccount(word) {
  const accountId = await sha256Hex('planner-id::' + word);
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(word), 'PBKDF2', false, ['deriveKey']);
  const saltSeed = await sha256Hex('planner-salt::' + word);
  const salt = enc.encode(saltSeed.slice(0, 16));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return { accountId, key };
}

// Uint8Array → base64 кусками: разворачивание всего массива в аргументы
// (`String.fromCharCode(...arr)`) падает на больших данных (лимит аргументов движка).
function toBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export async function encryptJSON(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return toBase64(iv) + ':' + toBase64(new Uint8Array(ct));
}

export async function decryptJSON(blob, key) {
  const [ivb64, ctb64] = blob.split(':');
  const iv = Uint8Array.from(atob(ivb64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctb64), (c) => c.charCodeAt(0));
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(data));
}

export async function cloudLoad(accountId) {
  const r = await fetch(`/api/sync?id=${accountId}`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('Не удалось загрузить данные из облака');
  const j = await r.json();
  return j.data; // { blob, updatedAt } | null
}

// keepalive позволяет запросу дожить, даже если вкладку закрыли или свернули
// (лимит keepalive-тела ~64 КБ, для больших данных отправляем обычным запросом).
export async function cloudSave(accountId, blob, { keepalive = false } = {}) {
  const body = JSON.stringify({ blob, updatedAt: Date.now() });
  const r = await fetch(`/api/sync?id=${accountId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: keepalive && body.length < 60000,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('Не удалось сохранить данные в облако');
  return r.json();
}
