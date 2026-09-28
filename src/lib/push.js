// Подключение push-уведомлений на устройстве.
// Публичный VAPID-ключ не секретный; задаётся при сборке (VITE_VAPID_PUBLIC_KEY, см. .env.example).
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Запрашивает разрешение, создаёт СВЕЖУЮ подписку и сохраняет её на сервере.
// Старую (возможно протухшую) подписку убираем — это позволяет переподписаться,
// даже если разрешение уже выдано, а подписка перестала работать.
export async function enablePush(accountId) {
  if (!pushSupported()) throw new Error('unsupported');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('denied');

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const oldEndpoint = existing ? existing.endpoint : null;
  if (existing) {
    try { await existing.unsubscribe(); } catch { /* ничего страшного */ }
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Передаём и старый endpoint, чтобы сервер убрал протухшую подписку сразу
  const r = await fetch(`/api/push-subscribe?id=${accountId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint }),
  });
  if (!r.ok) throw new Error('subscribe-failed');
  const data = await r.json().catch(() => ({}));
  return data.devices || 1;
}

export async function sendTestPush(accountId) {
  const r = await fetch(`/api/push-test?id=${accountId}`, { method: 'POST' });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || 'test-failed');
  }
  return r.json();
}
