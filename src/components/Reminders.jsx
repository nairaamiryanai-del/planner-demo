import { useState } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { usePlanner } from '../context/PlannerContext';
import { REMINDER_CATEGORIES, REPEAT_OPTIONS } from '../data/defaultData';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { parseDay, daysUntil } from '../lib/dates';
import { Plus, X, Check, Trash2, Edit3, Bell, Calendar, RefreshCw } from 'lucide-react';

export default function Reminders() {
  const { reminders, setReminders, scheduleReminder, unscheduleReminder } = usePlanner();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', date: '', time: '', remindTime: '', category: 'personal', repeat: 'none'
  });

  const resetForm = () => {
    setForm({ title: '', description: '', date: '', time: '', remindTime: '', category: 'personal', repeat: 'none' });
    setEditId(null);
    setShowAdd(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const reminder = {
      id: editId || uuidv4(),
      ...form,
      createdAt: editId
        ? (reminders.find(r => r.id === editId)?.createdAt || new Date().toISOString())
        : new Date().toISOString(),
    };
    setReminders(editId
      ? reminders.map(r => r.id === editId ? reminder : r)
      : [...reminders, reminder]);
    scheduleReminder(reminder);
    resetForm();
  };

  const handleEdit = (reminder) => {
    setForm({
      title: reminder.title,
      description: reminder.description || '',
      date: reminder.date || '',
      time: reminder.time || '',
      remindTime: reminder.remindTime || '',
      category: reminder.category || 'personal',
      repeat: reminder.repeat || 'none',
    });
    setEditId(reminder.id);
    setShowAdd(true);
  };

  const handleDelete = (id) => {
    setReminders(reminders.filter(r => r.id !== id));
    unscheduleReminder(id);
  };

  const sorted = [...reminders].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return parseDay(a.date) - parseDay(b.date);
  });

  // Сегодняшние напоминания остаются в «Предстоящих» весь день
  const upcoming = sorted.filter(r => !r.date || daysUntil(r.date) >= 0);
  const past = sorted.filter(r => r.date && daysUntil(r.date) < 0);

  return (
    <div className="reminders-page">
      <div className="section-header">
        <h2>Напоминания</h2>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Добавить
        </button>
      </div>

      {reminders.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} />
          <p>Нет напоминаний</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="reminders-section">
              <h3>🔔 Предстоящие</h3>
              <div className="reminders-list">
                {upcoming.map(r => <ReminderCard key={r.id} reminder={r} onEdit={handleEdit} onDelete={handleDelete} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div className="reminders-section">
              <h3>📋 Прошедшие</h3>
              <div className="reminders-list past">
                {past.map(r => <ReminderCard key={r.id} reminder={r} onEdit={handleEdit} onDelete={handleDelete} isPast />)}
              </div>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Редактировать напоминание' : 'Новое напоминание'}</h3>
              <button className="btn-icon" onClick={resetForm}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Название</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} autoFocus />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Дата</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Время события</label>
                  <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                  {form.time && <span className="time-confirm">🕐 {form.time} (24 ч)</span>}
                </div>
              </div>
              <div className="form-group">
                <label>Время напоминания</label>
                <input type="time" value={form.remindTime} onChange={e => setForm({...form, remindTime: e.target.value})} />
                {form.remindTime
                  ? <span className="time-confirm">🔔 Напомню в {form.remindTime} (24 ч)</span>
                  : <span className="form-hint">Если пусто — напомню во время события</span>}
              </div>
              <div className="form-group">
                <label>Категория</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {Object.entries(REMINDER_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Повтор</label>
                <select value={form.repeat} onChange={e => setForm({...form, repeat: e.target.value})}>
                  {Object.entries(REPEAT_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={resetForm}>Отмена</button>
                <button type="submit" className="btn-primary"><Check size={16} /> Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderCard({ reminder, onEdit, onDelete, isPast }) {
  const cat = REMINDER_CATEGORIES[reminder.category];
  const daysLeft = reminder.date ? daysUntil(reminder.date) : null;

  let countdownText = '';
  if (daysLeft !== null) {
    if (daysLeft === 0) countdownText = 'Сегодня!';
    else if (daysLeft === 1) countdownText = 'Завтра';
    else if (daysLeft > 1) countdownText = `Через ${daysLeft} дн.`;
    else countdownText = `${Math.abs(daysLeft)} дн. назад`;
  }

  return (
    <div className={`reminder-card ${isPast ? 'past' : ''} ${daysLeft === 0 ? 'today' : ''} ${daysLeft === 1 ? 'tomorrow' : ''}`}>
      <div className="reminder-left">
        <span className="reminder-emoji" style={{ color: cat?.color }}>{cat?.emoji}</span>
        <div className="reminder-info">
          <h4>{reminder.title}</h4>
          {reminder.description && <p>{reminder.description}</p>}
          <div className="reminder-meta">
            {reminder.date && (
              <span className="reminder-date">
                <Calendar size={12} />
                {format(parseDay(reminder.date), 'd MMMM yyyy', { locale: ru })}{reminder.time ? `, ${reminder.time}` : ''}
              </span>
            )}
            {reminder.remindTime && (
              <span className="reminder-notify">
                <Bell size={12} /> напомнить в {reminder.remindTime}
              </span>
            )}
            {reminder.repeat && reminder.repeat !== 'none' && (
              <span className="reminder-repeat">
                <RefreshCw size={12} /> {REPEAT_OPTIONS[reminder.repeat]}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="reminder-right">
        {countdownText && (
          <span className={`countdown ${daysLeft <= 1 ? 'urgent' : ''}`}>{countdownText}</span>
        )}
        <button className="btn-icon-sm" onClick={() => onEdit(reminder)} title="Изменить"><Edit3 size={14} /></button>
        <button className="btn-icon-sm" onClick={() => onDelete(reminder.id)} title="Удалить"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
