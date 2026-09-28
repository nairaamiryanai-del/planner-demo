import { useState, useMemo } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { usePlanner } from '../context/PlannerContext';
import { DAYS_OF_WEEK, ACTIVITY_TYPES } from '../data/defaultData';
import { daysUntil } from '../lib/dates';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isToday,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import {
  Plus, X, Check, Trash2, Edit3, MapPin, Clock, CheckCircle2, Circle, ListPlus,
  CalendarDays, ChevronLeft, ChevronRight, Wallet,
} from 'lucide-react';

// Ключ дня недели → номер getDay (0=Вс..6=Сб)
const WEEKDAY_NUM = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// ===== Разбор расписания, вставленного текстом =====
const DAY_ALIASES = {
  monday: ['понедельник', 'пн'],
  tuesday: ['вторник', 'вт'],
  wednesday: ['среда', 'ср'],
  thursday: ['четверг', 'чт'],
  friday: ['пятница', 'пт'],
  saturday: ['суббота', 'сб'],
  sunday: ['воскресенье', 'воскресение', 'вс'],
};

function parseDay(s) {
  const v = s.trim().toLowerCase().replace(/\.$/, '');
  for (const [key, names] of Object.entries(DAY_ALIASES)) {
    if (names.includes(v)) return key;
  }
  return null;
}

function parseTime(s) {
  // Понимаем 17:00, 17.00, 17,00 и армянское двоеточие «։»
  const m = s.trim().replace(/[.,։]/g, ':').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function guessType(name) {
  const n = name.toLowerCase();
  if (/плаван|бассейн|футбол|танц|спорт|бокс|гимнаст|карате|теннис|хокке|борьб/.test(n)) return 'sport';
  if (/музык|фортепиан|пианин|вокал|гитар|скрипк|хор/.test(n)) return 'music';
  if (/рисов|лепк|творч|арт|худож|керам/.test(n)) return 'art';
  if (/язык|армян|русск|англ|немец|француз|испан|китай|шахмат|матем|чтени|логопед|школ|учёб|учеб|програм/.test(n)) return 'study';
  return 'other';
}

// Строка: «День; Название; Время; Стоимость» (стоимость необязательна)
function parseBulk(text) {
  const items = [];
  const errors = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(/[;|\t]/).map(p => p.trim());
    if (parts.length < 3) {
      errors.push({ line: i + 1, text: line, reason: 'нужно минимум: день; название; время' });
      return;
    }
    const day = parseDay(parts[0]);
    const time = parseTime(parts[2]);
    const name = parts[1];
    if (!day) { errors.push({ line: i + 1, text: line, reason: 'не понятен день недели' }); return; }
    if (!name) { errors.push({ line: i + 1, text: line, reason: 'нет названия' }); return; }
    if (!time) { errors.push({ line: i + 1, text: line, reason: 'время не в формате ЧЧ:ММ' }); return; }
    const price = parts[3] ? Number(parts[3].replace(/[^\d]/g, '')) || 0 : 0;
    items.push({ day, name, time, price, type: guessType(name) });
  });
  return { items, errors };
}

export default function ChildActivities() {
  const {
    childActivities, setChildActivities, scheduleActivity, unscheduleActivity,
    childAttendance, setChildAttendance,
  } = usePlanner();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    name: '', child: '', day: 'monday', time: '12:00', duration: 60, type: 'sport', location: '', price: '', paid: false
  });

  const resetForm = () => {
    setForm({ name: '', child: '', day: 'monday', time: '12:00', duration: 60, type: 'sport', location: '', price: '', paid: false });
    setEditId(null);
  };

  const togglePaid = (id) => {
    setChildActivities(childActivities.map(a => a.id === id ? { ...a, paid: !a.paid } : a));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const activity = { id: editId || uuidv4(), ...form, duration: Number(form.duration), price: Number(form.price) || 0, paid: !!form.paid };
    if (editId) {
      setChildActivities(childActivities.map(a => a.id === editId ? activity : a));
    } else {
      setChildActivities([...childActivities, activity]);
    }
    scheduleActivity(activity);
    resetForm();
    setShowAdd(false);
  };

  const handleEdit = (activity) => {
    setForm({ ...activity });
    setEditId(activity.id);
    setShowAdd(true);
  };

  const handleDelete = (id) => {
    setChildActivities(childActivities.filter(a => a.id !== id));
    unscheduleActivity(id);
  };

  // ===== Добавить списком =====
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const parsed = parseBulk(bulkText);
  const isDuplicate = (it) => childActivities.some(a =>
    a.day === it.day && a.time === it.time && a.name.trim().toLowerCase() === it.name.toLowerCase()
  );
  const newItems = parsed.items.filter(it => !isDuplicate(it));

  const closeBulk = () => { setShowBulk(false); setBulkText(''); };

  const handleBulkAdd = () => {
    if (newItems.length === 0) return;
    const created = newItems.map(it => ({
      id: uuidv4(),
      name: it.name,
      child: '',
      day: it.day,
      time: it.time,
      duration: 60,
      type: it.type,
      location: '',
      price: it.price,
      paid: false,
    }));
    setChildActivities([...childActivities, ...created]);
    created.forEach(scheduleActivity);
    closeBulk();
  };

  const dayLabel = (key) => DAYS_OF_WEEK.find(d => d.key === key)?.full || key;

  // ===== Календарь месяца: отметки «был на занятии» и «оплачено» =====
  const [calMonth, setCalMonth] = useState(new Date());

  const lessonsFor = (day) => childActivities
    .filter(a => WEEKDAY_NUM[a.day] === getDay(day))
    .sort((a, b) => a.time.localeCompare(b.time));

  const markOf = (activityId, ds) =>
    childAttendance.find(m => m.activityId === activityId && m.date === ds);

  // Клик по занятию в клетке: нет отметки → «был» → «был и оплачено» → сброс
  const cycleMark = (activityId, ds) => {
    const existing = markOf(activityId, ds);
    if (!existing) {
      setChildAttendance([...childAttendance, {
        id: `${activityId}:${ds}`, activityId, date: ds, attended: true, paid: false,
      }]);
    } else if (existing.attended && !existing.paid) {
      setChildAttendance(childAttendance.map(m => m.id === existing.id ? { ...m, paid: true } : m));
    } else {
      setChildAttendance(childAttendance.filter(m => m.id !== existing.id));
    }
  };

  const calDays = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });
  const calPad = (getDay(startOfMonth(calMonth)) + 6) % 7;

  const monthStats = useMemo(() => {
    let passed = 0, attended = 0, paidSum = 0, dueSum = 0;
    for (const day of calDays) {
      const ds = format(day, 'yyyy-MM-dd');
      const inPast = daysUntil(ds) <= 0;
      for (const a of lessonsFor(day)) {
        const m = markOf(a.id, ds);
        if (inPast) passed++;
        if (m?.attended) attended++;
        if (m?.paid) paidSum += a.price || 0;
        if (m?.attended && !m?.paid) dueSum += a.price || 0;
      }
    }
    return { passed, attended, paidSum, dueSum };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childActivities, childAttendance, calMonth]);

  return (
    <div className="kids-page">
      <div className="section-header">
        <h2>Недельное расписание</h2>
        <div className="kids-header-actions">
          <button className="btn-secondary" onClick={() => setShowBulk(true)}>
            <ListPlus size={16} /> Добавить списком
          </button>
          <button className="btn-primary" onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus size={16} /> Добавить
          </button>
        </div>
      </div>

      <div className="week-schedule">
        {DAYS_OF_WEEK.map(day => {
          const dayActivities = childActivities
            .filter(a => a.day === day.key)
            .sort((a, b) => a.time.localeCompare(b.time));

          return (
            <div key={day.key} className="day-column">
              <div className="day-column-header">
                <span className="day-label">{day.label}</span>
                <span className="day-full">{day.full}</span>
              </div>
              <div className="day-activities">
                {dayActivities.length === 0 ? (
                  <div className="empty-day">—</div>
                ) : (
                  dayActivities.map(activity => {
                    const type = ACTIVITY_TYPES[activity.type];
                    return (
                      <div
                        key={activity.id}
                        className="activity-card"
                        style={{ borderLeftColor: type?.color }}
                      >
                        <div className="activity-header">
                          <span className="activity-emoji">{type?.emoji}</span>
                          <span className="activity-name">{activity.name}</span>
                          <div className="activity-actions">
                            <button className="btn-icon-xs" onClick={() => handleEdit(activity)}>
                              <Edit3 size={12} />
                            </button>
                            <button className="btn-icon-xs" onClick={() => handleDelete(activity.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="activity-meta">
                          <span><Clock size={11} /> {activity.time} • {activity.duration} мин</span>
                        </div>
                        {activity.location && (
                          <div className="activity-location">
                            <MapPin size={11} /> {activity.location}
                          </div>
                        )}
                        {activity.child && (
                          <span className="activity-child">{activity.child}</span>
                        )}
                        <div className="activity-pay">
                          <button
                            type="button"
                            className={`pay-toggle ${activity.paid ? 'paid' : ''}`}
                            onClick={() => togglePaid(activity.id)}
                          >
                            {activity.paid ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                            {activity.paid ? 'Оплачено' : 'Не оплачено'}
                          </button>
                          {activity.price > 0 && (
                            <span className="activity-price">{activity.price.toLocaleString('ru-RU')} ₽</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {childActivities.length > 0 && (
        <div className="kids-month">
          <div className="section-header kids-month-header">
            <h2><CalendarDays size={20} /> Посещения и оплата</h2>
          </div>

          <div className="cycle-stats">
            <div className="cycle-stat">
              <span className="cycle-stat-value">{monthStats.attended}{monthStats.passed ? `/${monthStats.passed}` : ''}</span>
              <span className="cycle-stat-label">Посещено из прошедших</span>
            </div>
            <div className="cycle-stat">
              <span className="cycle-stat-value">{monthStats.paidSum.toLocaleString('ru-RU')} ₽</span>
              <span className="cycle-stat-label">Оплачено за месяц</span>
            </div>
            <div className="cycle-stat">
              <span className="cycle-stat-value">{monthStats.dueSum.toLocaleString('ru-RU')} ₽</span>
              <span className="cycle-stat-label">К оплате за посещённые</span>
            </div>
          </div>

          <div className="calendar-header-bar">
            <button className="btn-icon" onClick={() => setCalMonth(subMonths(calMonth, 1))}><ChevronLeft size={20} /></button>
            <h3>{format(calMonth, 'LLLL yyyy', { locale: ru })}</h3>
            <button className="btn-icon" onClick={() => setCalMonth(addMonths(calMonth, 1))}><ChevronRight size={20} /></button>
          </div>

          <div className="calendar-grid kids-grid">
            {DAYS_OF_WEEK.map(d => (
              <div key={d.key} className="calendar-day-header">{d.label}</div>
            ))}
            {Array.from({ length: calPad }, (_, i) => <div key={`pad-${i}`} className="calendar-cell empty" />)}
            {calDays.map(day => {
              const ds = format(day, 'yyyy-MM-dd');
              const lessons = lessonsFor(day);
              const past = daysUntil(ds) <= 0;
              return (
                <div
                  key={ds}
                  className={`calendar-cell kids-cell ${isToday(day) ? 'today' : ''}`}
                >
                  <span className="day-number">{format(day, 'd')}</span>
                  {lessons.map(a => {
                    const m = markOf(a.id, ds);
                    const type = ACTIVITY_TYPES[a.type];
                    const status = m?.attended ? (m.paid ? 'paid' : 'attended') : past ? 'missed' : 'future';
                    const title = `${a.name}, ${a.time}${a.price ? `, ${a.price} ₽` : ''}. ` +
                      (status === 'paid' ? 'Был, оплачено. Клик — сбросить.'
                        : status === 'attended' ? 'Был. Клик — отметить оплату.'
                        : 'Клик — отметить «был».');
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`cal-lesson ${status}`}
                        style={status === 'future' ? { borderColor: type?.color } : undefined}
                        title={title}
                        onClick={() => cycleMark(a.id, ds)}
                      >
                        <span className="cal-lesson-emoji">{type?.emoji}</span>
                        <span className="cal-lesson-time">{a.time}</span>
                        {status === 'attended' && <Check size={11} strokeWidth={3} />}
                        {status === 'paid' && <Wallet size={11} />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="cycle-legend">
            <span><span className="cycle-dot" style={{ background: '#10b981' }} /> 1-й клик: был</span>
            <span><span className="cycle-dot" style={{ background: '#c98a3c' }} /> 2-й клик: был и оплачено</span>
            <span><span className="cycle-dot" style={{ background: '#c9c6bc' }} /> 3-й: сброс. Серое — прошло без отметки</span>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Редактировать' : 'Новая активность'}</h3>
              <button className="btn-icon" onClick={() => { setShowAdd(false); resetForm(); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Название</label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />
                </div>
                <div className="form-group">
                  <label>Ребёнок</label>
                  <input type="text" value={form.child} onChange={e => setForm({...form, child: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>День</label>
                  <select value={form.day} onChange={e => setForm({...form, day: e.target.value})}>
                    {DAYS_OF_WEEK.map(d => <option key={d.key} value={d.key}>{d.full}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Тип</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    {Object.entries(ACTIVITY_TYPES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Время</label>
                  <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                  {form.time && <span className="time-confirm">🕐 {form.time} (24 ч)</span>}
                </div>
                <div className="form-group">
                  <label>Длительность (мин)</label>
                  <input type="number" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Место</label>
                  <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Стоимость (₽)</label>
                  <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0" />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowAdd(false); resetForm(); }}>Отмена</button>
                <button type="submit" className="btn-primary"><Check size={16} /> {editId ? 'Сохранить' : 'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Добавить списком</h3>
              <button className="btn-icon" onClick={closeBulk}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p className="form-hint">
                Одна строка, одно занятие: <b>День; Название; Время; Стоимость</b>.
                Стоимость можно не указывать. Дни можно сокращать (Пн, Вт…).
              </p>
              <textarea
                className="bulk-textarea"
                rows={8}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={'Например:\nПонедельник; Плавание; 17:00; 450\nСреда; Шахматы; 15:00; 1000'}
                autoFocus
              />

              {(parsed.items.length > 0 || parsed.errors.length > 0) && (
                <div className="bulk-preview">
                  {parsed.items.map((it, i) => {
                    const dup = isDuplicate(it);
                    const type = ACTIVITY_TYPES[it.type];
                    return (
                      <div key={i} className={`bulk-row ${dup ? 'dup' : ''}`}>
                        <span>{type?.emoji}</span>
                        <span className="bulk-day">{dayLabel(it.day)}</span>
                        <span className="bulk-time">{it.time}</span>
                        <span className="bulk-name">{it.name}</span>
                        <span className="bulk-price">{it.price ? `${it.price.toLocaleString('ru-RU')} ₽` : ''}</span>
                        {dup && <span className="bulk-note">уже есть</span>}
                      </div>
                    );
                  })}
                  {parsed.errors.map((er) => (
                    <div key={`e${er.line}`} className="bulk-row error">
                      <span>⚠️</span>
                      <span className="bulk-name">Строка {er.line}: {er.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeBulk}>Отмена</button>
                <button type="button" className="btn-primary" onClick={handleBulkAdd} disabled={newItems.length === 0}>
                  <Check size={16} /> Добавить {newItems.length > 0 ? newItems.length : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
