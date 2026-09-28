import { useState } from 'react';
import { Cloud, Lock, Loader2 } from 'lucide-react';

export default function LockScreen({ onSignIn, onSkip }) {
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!word.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onSignIn(word);
    } catch {
      setError('Не удалось подключиться. Проверь интернет и попробуй снова.');
      setBusy(false);
    }
  };

  return (
    <div className="lock-overlay">
      <div className="lock-card">
        <div className="lock-icon"><Cloud size={28} /></div>
        <h2>Синхронизация устройств</h2>
        <p className="lock-text">
          Придумай <strong>кодовое слово</strong>. Введи одно и то же слово на телефоне и компьютере —
          и записи будут везде одинаковыми.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="lock-input">
            <Lock size={16} />
            <input
              type="password"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Кодовое слово"
              autoFocus
              autoComplete="off"
            />
          </div>
          {error && <p className="lock-error">{error}</p>}
          <button type="submit" className="btn-primary lock-submit" disabled={busy}>
            {busy ? <><Loader2 size={16} className="spin" /> Подключаюсь…</> : 'Войти'}
          </button>
        </form>

        <p className="lock-warning">
          ⚠️ Запиши слово в надёжном месте — восстановить его нельзя.
        </p>
        <button type="button" className="btn-text lock-skip" onClick={onSkip}>
          Пока без синхронизации (только это устройство)
        </button>
      </div>
    </div>
  );
}
