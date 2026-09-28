// Авто-обновление PWA: когда выходит новая версия, показываем плашку «Обновить».
// Один тап — service worker применяет новую версию и перезагружает страницу.
import { registerSW } from 'virtual:pwa-register';

export function setupPwaUpdate() {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      if (!reg) return;
      // Раз в час и при каждом возврате в приложение проверяем, нет ли новой версии
      setInterval(() => { reg.update().catch(() => {}); }, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    },
    onNeedRefresh() {
      showUpdateBanner(() => updateSW(true));
    },
  });
}

function showUpdateBanner(onUpdate) {
  if (document.getElementById('pwa-update-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'pwa-update-banner';
  bar.className = 'pwa-update-banner';

  const text = document.createElement('span');
  text.textContent = 'Доступна новая версия';
  bar.appendChild(text);

  const btn = document.createElement('button');
  btn.textContent = 'Обновить';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Обновляю…';
    onUpdate();
  });
  bar.appendChild(btn);

  document.body.appendChild(bar);
}
