import { useState, useMemo } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { usePlanner } from '../context/PlannerContext';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isToday, isSameDay, differenceInCalendarDays, getDaysInMonth
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { parseDay } from '../lib/dates';
import { ChevronLeft, ChevronRight, Plus, X, Check, RefreshCw, Clock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { PRIORITIES, ACTIVITY_TYPES, REMINDER_CATEGORIES } from '../data/defaultData';

const TYPE_META = {
  task: { emoji: '✅', label: 'Задача' },
  reminder: { emoji: '🔔', label: 'Напоминание' },
  project: { emoji: '💼', label: 'Проект' },
  goal: { emoji: '🎯', label: 'Цель' },
  kids: { emoji: '🧒', label: 'Дети' },
  trip: { emoji: '✈️', label: 'Поездка' },
};

// Ключ дня недели (defaultData) → номер getDay (0=Вс..6=Сб)
const WEEKDAY_NUM = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// Грамматически верные подписи «Каждый/Каждую/Каждое <день>»
const WEEKLY_LABEL = {
  1: 'Каждый понедельник', 2: 'Каждый вторник', 3: 'Каждую среду',
  4: 'Каждый четверг', 5: 'Каждую пятницу', 6: 'Каждую субботу',
  0: 'Каждое воскресенье',
};

export default function CalendarView() {
  const {
    tasks, reminders, setReminders, scheduleReminder,
    freelanceProjects, goals, childActivities, trips,
  } = usePlanner();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', time: '', remindTime: '', description: '', repeat: 'none' });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = (getDay(monthStart) + 6) % 7;
  const paddingDays = Array.from({ length: startPadding }, () => null);

  // Собираем ВСЕ события с датой на конкретный день (с раскрытием повторов)
  const getEventsForDay = (day) => {
    const dow = getDay(day);
    const events = [];

    tasks.forEach(t => {
      if (t.deadline && isSameDay(parseDay(t.deadline), day)) {
        events.push({
          key: 't-' + t.id, type: 'task', title: t.title, desc: t.description,
          color: PRIORITIES[t.priority]?.color || '#94a3b8',
        });
      }
    });

    reminders.forEach(r => {
      if (!r.date) return;
      const start = parseDay(r.date);
      const diff = differenceInCalendarDays(day, start);
      if (diff < 0) return; // до даты начала не показываем
      let occurs = false;
      switch (r.repeat) {
        case 'daily': occurs = true; break;
        case 'weekly': occurs = getDay(start) === dow; break;
        // В коротком месяце событие «31-го числа» показываем в последний день месяца
        case 'monthly': occurs = day.getDate() === Math.min(start.getDate(), getDaysInMonth(day)); break;
        case 'yearly': occurs = start.getMonth() === day.getMonth() && day.getDate() === Math.min(start.getDate(), getDaysInMonth(day)); break;
        default: occurs = diff === 0; // без повтора
      }
      if (occurs) {
        events.push({
          key: 'r-' + r.id, type: 'reminder', title: r.title, desc: r.description,
          time: r.time, repeat: r.repeat && r.repeat !== 'none',
          color: REMINDER_CATEGORIES[r.category]?.color || '#6366f1',
        });
      }
    });

    freelanceProjects.forEach(p => {
      if (p.archived) return;
      if (p.deadline && isSameDay(parseDay(p.deadline), day)) {
        events.push({
          key: 'p-' + p.id, type: 'project', title: p.name, sub: 'дедлайн',
          color: '#5a6b50',
        });
      }
    });

    goals.forEach(g => {
      if (g.deadline && isSameDay(parseDay(g.deadline), day)) {
        events.push({
          key: 'g-' + g.id, type: 'goal', title: g.title, sub: 'цель',
          color: '#c98a3c',
        });
      }
    });

    childActivities.forEach(a => {
      if (WEEKDAY_NUM[a.day] === dow) {
        const type = ACTIVITY_TYPES[a.type];
        events.push({
          key: 'a-' + a.id, type: 'kids', title: a.name, time: a.time,
          sub: a.child, repeat: true, color: type?.color || '#06b6d4',
        });
      }
    });

    trips.forEach(tr => {
      if (!tr.dateFrom) return;
      const from = parseDay(tr.dateFrom);
      const to = tr.dateTo ? parseDay(tr.dateTo) : from;
      if (differenceInCalendarDays(day, from) >= 0 && differenceInCalendarDays(to, day) >= 0) {
        events.push({
          key: 'trip-' + tr.id, type: 'trip', title: tr.destination,
          color: '#f97316',
        });
      }
    });

    // Сначала события со временем (по возрастанию), потом без времени
    return events.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
  };

  // События месяца считаем один раз при изменении данных, а не на каждый клик
  const eventsByDay = useMemo(() => {
    const map = new Map();
    days.forEach(d => map.set(format(d, 'yyyy-MM-dd'), getEventsForDay(d)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, tasks, reminders, freelanceProjects, goals, childActivities, trips]);

  const selectedEvents = selectedDay ? (eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) || getEventsForDay(selectedDay)) : [];

  const openAdd = () => {
    setForm({ title: '', time: '', remindTime: '', description: '', repeat: 'none' });
    setShowAdd(true);
  };

  const handleAddEvent = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !selectedDay) return;
    const reminder = {
      id: uuidv4(),
      title: form.title.trim(),
      description: form.description,
      date: format(selectedDay, 'yyyy-MM-dd'),
      time: form.time,
      remindTime: form.remindTime,
      category: 'personal',
      repeat: form.repeat,
      createdAt: new Date().toISOString(),
    };
    setReminders([...reminders, reminder]);
    scheduleReminder(reminder);
    setShowAdd(false);
  };

  // Варианты повтора для формы (еженедельный — с учётом выбранного дня)
  const repeatOptions = selectedDay ? {
    none: 'Без повтора',
    daily: 'Каждый день',
    weekly: WEEKLY_LABEL[getDay(selectedDay)],
    monthly: 'Каждый месяц',
    yearly: 'Каждый год',
  } : {};

  return (
    <div className="calendar-page">
      <div className="calendar-header-bar">
        <button className="btn-icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft size={20} />
        </button>
        <h2>{format(currentMonth, 'LLLL yyyy', { locale: ru })}</h2>
        <button className="btn-icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="calendar-legend">
        {Object.entries(TYPE_META).map(([k, m]) => (
          <span key={k} className="legend-item">{m.emoji} {m.label}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
          <div key={d} className="calendar-day-header">{d}</div>
        ))}
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} className="calendar-cell empty" />
        ))}
        {days.map(day => {
          const dayEvents = eventsByDay.get(format(day, 'yyyy-MM-dd')) || [];
          const hasItems = dayEvents.length > 0;
          const selected = selectedDay && isSameDay(day, selectedDay);

          return (
            <div
              key={day.toISOString()}
              className={`calendar-cell ${isToday(day) ? 'today' : ''} ${selected ? 'selected' : ''} ${hasItems ? 'has-items' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              <span className="day-number">{format(day, 'd')}</span>
              {hasItems && (
                <div className="day-dots">
                  {dayEvents.slice(0, 4).map(ev => (
                    <span key={ev.key} className="day-dot" style={{ background: ev.color }} />
                  ))}
                  {dayEvents.length > 4 && <span className="day-more">+{dayEvents.length - 4}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div className="calendar-detail">
          <div className="calendar-detail-header">
            <h3>{format(selectedDay, 'd MMMM, EEEE', { locale: ru })}</h3>
            <button className="btn-secondary" onClick={openAdd}>
              <Plus size={14} /> Добавить событие
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="empty-text">Нет событий на этот день</p>
          ) : (
            <div className="day-events">
              {selectedEvents.map(ev => (
                <div key={ev.key} className="day-event-card">
                  <span className="event-priority" style={{ background: ev.color }} />
                  <div className="event-body">
                    <strong>{TYPE_META[ev.type].emoji} {ev.title}</strong>
                    <div className="event-meta-row">
                      <span className="event-type-tag">{TYPE_META[ev.type].label}</span>
                      {ev.time && <span className="event-time"><Clock size={11} /> {ev.time}</span>}
                      {ev.sub && <span className="event-sub">{ev.sub}</span>}
                      {ev.repeat && <span className="event-repeat"><RefreshCw size={11} /> повтор</span>}
                    </div>
                    {ev.desc && <p>{ev.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && selectedDay && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Новое событие — {format(selectedDay, 'd MMMM', { locale: ru })}</h3>
              <button className="btn-icon" onClick={() => setShowAdd(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEvent} className="modal-body">
              <div className="form-group">
                <label>Название</label>
                <input
                  type="text" value={form.title} autoFocus
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Что за событие?"
                />
              </div>
              <div className="form-group">
                <label>Время события</label>
                <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                {form.time && <span className="time-confirm">🕐 {form.time} (24 ч)</span>}
              </div>
              <div className="form-group">
                <label>Время напоминания</label>
                <input type="time" value={form.remindTime} onChange={e => setForm({ ...form, remindTime: e.target.value })} />
                {form.remindTime
                  ? <span className="time-confirm">🔔 Напомню в {form.remindTime} (24 ч)</span>
                  : <span className="form-hint">Если пусто — напомню во время события</span>}
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="form-group">
                <label>Повтор</label>
                <select value={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.value })}>
                  {Object.entries(repeatOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <p className="form-hint">Событие появится в календаре и в разделе «Напоминания», по нему придёт уведомление.</p>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Отмена</button>
                <button type="submit" className="btn-primary"><Check size={16} /> Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
