import { useState } from 'react';
import { Bell, BellOff, BellRing, Send } from 'lucide-react';
import { usePlanner } from '../context/PlannerContext';

export default function NotificationButton() {
  const { pushState, enableNotifications, sendTestNotification, codeWord } = usePlanner();
  const [busy, setBusy] = useState(false);

  if (pushState === 'unsupported') return null;

  const handleEnable = async () => {
    if (!codeWord) {
      alert('Чтобы получать уведомления, сначала войди по кодовому слову (синхронизация).');
      return;
    }
    setBusy(true);
    try {
      const devices = await enableNotifications();
      alert(`Готово! Свежая подписка на этом устройстве создана. Подключено устройств: ${devices}.\n\nТеперь нажми «Прислать тест» (✈️) и заблокируй телефон — проверим сигнал.`);
    } catch (e) {
      if (e.message === 'denied') {
        alert('Разрешение на уведомления отклонено. Включи его в настройках браузера для этого сайта.');
      } else if (e.message === 'no-account') {
        alert('Секунду, ещё идёт подключение к облаку. Попробуй снова через пару секунд.');
      } else {
        alert('Не получилось включить уведомления. Попробуй ещё раз.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      await sendTestNotification();
    } catch (e) {
      if (e.message === 'no devices subscribed') {
        alert('Сначала включи уведомления (колокольчик).');
      } else {
        alert('Не удалось отправить тест. Проверь интернет.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (pushState === 'granted') {
    return (
      <>
        <button className="btn-icon" onClick={handleEnable} disabled={busy} title="Обновить подписку на этом устройстве">
          <BellRing size={18} />
        </button>
        <button className="btn-icon" onClick={handleTest} disabled={busy} title="Прислать тестовое уведомление">
          <Send size={18} />
        </button>
      </>
    );
  }

  return (
    <button className="btn-icon" onClick={handleEnable} disabled={busy} title="Включить уведомления">
      {pushState === 'denied' ? <BellOff size={18} /> : <Bell size={18} />}
    </button>
  );
}
