import { useState, useMemo } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { usePlanner } from '../context/PlannerContext';
import { SYNC_ENABLED } from '../lib/config';
import { MED_TIMES, WATER_NORM } from '../data/defaultData';
import { parseDay, daysUntil, todayStr } from '../lib/dates';
import { v4 as uuidv4 } from 'uuid';
import {
  format, isSameDay, subDays, eachDayOfInterval,
  startOfMonth, endOfMonth, getDay, addMonths, subMonths,
  addDays, differenceInCalendarDays
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Plus, X, Check, Trash2, Edit3, Heart, Pill, Droplets,
  CheckSquare, Square, Moon, Sun, Sunrise, Sunset,
  TrendingUp, Calendar, Flame, Clock,
  Archive, RotateCcw, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight
} from 'lucide-react';

const TIME_ICONS = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};

const MED_REPEAT = {
  none: 'Не повторять',
  '1': 'Раз в месяц',
  '3': 'Раз в 3 месяца',
  '6': 'Раз в 6 месяцев',
  '12': 'Раз в год',
};

// Статистика по препарату из его записей журнала (даты — календарные дни).
function computeMedStats(med, medLogs) {
  const timesCount = (med.times || []).length;
  const uniqueDays = [...new Set(medLogs.map(l => l.date))].sort();
  const totalDaysTaken = uniqueDays.length;
  const isFullDay = (n) => timesCount > 0 && n >= timesCount;

  const startDate = med.startDate ? parseDay(med.startDate) : (med.createdAt ? parseDay(med.createdAt) : null);
  const rawSince = startDate ? differenceInCalendarDays(new Date(), startDate) + 1 : null;
  const daysSinceStart = rawSince != null && rawSince >= 1 ? rawSince : null;

  const daysLeft = med.endDate ? daysUntil(med.endDate) : null;
  const courseDuration = (med.startDate && med.endDate)
    ? differenceInCalendarDays(parseDay(med.endDate), parseDay(med.startDate)) + 1
    : null;
  const courseProgress = (courseDuration && daysSinceStart)
    ? Math.min(Math.max(Math.round((daysSinceStart / courseDuration) * 100), 0), 100)
    : null;

  // Подсчёт записей по датам за один проход
  const countByDate = new Map();
  for (const l of medLogs) countByDate.set(l.date, (countByDate.get(l.date) || 0) + 1);

  // Серия: если сегодня приём ещё не завершён, считаем со вчерашнего дня,
  // чтобы серия не «сгорала» каждое утро до первой отметки.
  const today = todayStr();
  const todayFull = isFullDay(countByDate.get(today) || 0);
  let streak = 0;
  for (let i = todayFull ? 0 : 1; i <= 366; i++) {
    const checkDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
    if (isFullDay(countByDate.get(checkDate) || 0)) streak++;
    else break;
  }

  // Соблюдение за последние 30 дней
  const last30 = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
  let fullDays30 = 0;
  let partialDays30 = 0;
  last30.forEach(day => {
    if (startDate && day < startDate) return;
    const n = countByDate.get(format(day, 'yyyy-MM-dd')) || 0;
    if (isFullDay(n)) fullDays30++;
    else if (n > 0) partialDays30++;
  });
  const applicableDays = rawSince != null ? Math.min(30, Math.max(rawSince, 0)) : 30;
  const adherenceRate = applicableDays > 0 ? Math.round((fullDays30 / applicableDays) * 100) : 0;

  return { totalDaysTaken, daysSinceStart, daysLeft, courseDuration, courseProgress, streak, adherenceRate, fullDays30, partialDays30, applicableDays };
}

export default function Health() {
  const {
    healthMeds, setHealthMeds, healthLog, setHealthLog, scheduleMed, unscheduleMed,
    codeWord, waterRemindersOn, toggleWaterReminders,
    periodDays, setPeriodDays,
  } = usePlanner();
  const [cycleMonth, setCycleMonth] = useState(new Date());
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [resuming, setResuming] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [activeTab, setActiveTab] = useState('meds');
  const [form, setForm] = useState({
    name: '', dosage: '', times: ['morning'], startDate: '', endDate: '', notes: '', repeatCourse: 'none'
  });

  const today = todayStr();

  const closeModal = () => {
    setForm({ name: '', dosage: '', times: ['morning'], startDate: '', endDate: '', notes: '', repeatCourse: 'none' });
    setEditId(null);
    setResuming(false);
    setShowAdd(false);
  };

  const handleEditMed = (med) => {
    setForm({
      name: med.name,
      dosage: med.dosage || '',
      times: med.times?.length ? med.times : ['morning'],
      startDate: med.startDate || '',
      endDate: med.endDate || '',
      notes: med.notes || '',
      repeatCourse: med.repeatCourse || 'none',
    });
    setEditId(med.id);
    setResuming(false);
    setShowAdd(true);
  };

  // Возобновить: новый курс того же лекарства (даты с сегодня), счётчик курсов +1
  const resumeMed = (med) => {
    setForm({
      name: med.name,
      dosage: med.dosage || '',
      times: med.times?.length ? med.times : ['morning'],
      startDate: today,
      endDate: '',
      notes: med.notes || '',
      repeatCourse: med.repeatCourse || 'none',
    });
    setEditId(med.id);
    setResuming(true);
    setShowAdd(true);
  };

  const handleAddMed = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.times.length) {
      alert('Выбери хотя бы одно время приёма.');
      return;
    }
    if (editId) {
      const prev = healthMeds.find(m => m.id === editId) || {};
      const updated = {
        ...prev, ...form,
        active: true,
        archived: false,
        courseCount: resuming ? (prev.courseCount || 1) + 1 : (prev.courseCount || 1),
      };
      setHealthMeds(healthMeds.map(m => m.id === editId ? updated : m));
      scheduleMed(updated);
    } else {
      const med = {
        id: uuidv4(),
        ...form,
        active: true,
        archived: false,
        courseCount: 1,
        createdAt: new Date().toISOString(),
      };
      setHealthMeds([...healthMeds, med]);
      scheduleMed(med);
    }
    closeModal();
  };

  const archiveMed = (id) => {
    const med = healthMeds.find(m => m.id === id);
    if (!med) return;
    const updated = { ...med, archived: true };
    setHealthMeds(healthMeds.map(m => m.id === id ? updated : m));
    scheduleMed(updated); // снимет все напоминания (archived)
  };

  const handleDeleteMed = (id) => {
    setHealthMeds(healthMeds.filter(m => m.id !== id));
    setHealthLog(healthLog.filter(l => l.medId !== id));
    unscheduleMed(id);
  };

  const toggleMedTime = (time) => {
    const times = form.times.includes(time)
      ? form.times.filter(t => t !== time)
      : [...form.times, time];
    setForm({ ...form, times });
  };

  const markTaken = (medId, time) => {
    // «Сегодня» считаем в момент клика: вкладка PWA может жить сутками
    const day = todayStr();
    const existing = healthLog.find(l => l.medId === medId && l.time === time && l.date === day);
    if (existing) {
      setHealthLog(healthLog.filter(l => l.id !== existing.id));
    } else {
      setHealthLog([...healthLog, {
        id: uuidv4(),
        medId,
        time,
        date: day,
        takenAt: new Date().toISOString(),
      }]);
    }
  };

  const isTaken = (medId, time) => {
    return healthLog.some(l => l.medId === medId && l.time === time && l.date === today);
  };

  const activeMeds = healthMeds.filter(m => m.active && !m.archived);
  const archivedMeds = healthMeds.filter(m => m.archived);

  // Статистика по всем препаратам за один проход и только при изменении данных:
  // раньше пересчитывалась для каждого препарата на каждый рендер (365 итераций
  // с фильтром журнала внутри), что при большом журнале заметно тормозило.
  const medStatsById = useMemo(() => {
    const logsByMed = new Map();
    for (const l of healthLog) {
      if (!l.medId) continue;
      if (!logsByMed.has(l.medId)) logsByMed.set(l.medId, []);
      logsByMed.get(l.medId).push(l);
    }
    const map = new Map();
    for (const med of healthMeds) map.set(med.id, computeMedStats(med, logsByMed.get(med.id) || []));
    return map;
  }, [healthMeds, healthLog]);
  const getMedStats = (med) => medStatsById.get(med.id) || computeMedStats(med, []);

  // Трекер воды (в мл), берём напрямую из журнала — всегда актуально
  const waterMl = healthLog.find(l => l.type === 'water' && l.date === today)?.ml || 0;

  const addWater = (delta) => {
    const day = todayStr();
    const current = healthLog.find(l => l.type === 'water' && l.date === day)?.ml || 0;
    const newMl = Math.max(0, current + delta);
    const idx = healthLog.findIndex(l => l.type === 'water' && l.date === day);
    if (idx >= 0) {
      const updated = [...healthLog];
      updated[idx] = { ...updated[idx], ml: newMl };
      setHealthLog(updated);
    } else {
      setHealthLog([...healthLog, { id: uuidv4(), type: 'water', date: day, ml: newMl }]);
    }
  };

  const handleWaterToggle = (on) => {
    if (on && !codeWord) {
      alert(SYNC_ENABLED
        ? 'Чтобы приходили напоминания о воде, сначала войди по кодовому слову и включи уведомления (колокольчик в шапке).'
        : 'В демо-версии push-уведомления выключены: для них нужна серверная часть (см. README).');
      return;
    }
    toggleWaterReminders(on);
  };

  // ===== Календарь месячных =====
  const periodSet = new Set(periodDays);
  const togglePeriodDay = (dateStr) => {
    setPeriodDays(periodSet.has(dateStr)
      ? periodDays.filter(d => d !== dateStr)
      : [...periodDays, dateStr].sort());
  };

  // Отметить период целиком: с «начала» по «конец» (если конец пуст — только начало)
  const markRange = () => {
    if (!rangeStart) return;
    const start = parseDay(rangeStart);
    const end = rangeEnd ? parseDay(rangeEnd) : start;
    if (end < start) {
      alert('«Конец» не может быть раньше «начала».');
      return;
    }
    const toAdd = [];
    let d = start;
    let guard = 0;
    while (d <= end && guard < 60) {
      toAdd.push(format(d, 'yyyy-MM-dd'));
      d = addDays(d, 1);
      guard++;
    }
    setPeriodDays([...new Set([...periodDays, ...toAdd])].sort());
    setCycleMonth(start);
    setRangeStart('');
    setRangeEnd('');
  };

  // Все вычисления цикла — только при изменении отметок, а не на каждый рендер
  const cycleInfo = useMemo(() => {
    const sortedPeriods = [...periodDays].sort();
    const set = new Set(sortedPeriods);
    // Начала месячных — первый день каждого «прогона» подряд идущих дней
    const periodStarts = sortedPeriods.filter(d =>
      !set.has(format(subDays(parseDay(d), 1), 'yyyy-MM-dd'))
    );
    // Длины циклов между стартами (санитарный диапазон 15–60 дней)
    const cycleLengths = [];
    for (let i = 1; i < periodStarts.length; i++) {
      const diff = differenceInCalendarDays(parseDay(periodStarts[i]), parseDay(periodStarts[i - 1]));
      if (diff >= 15 && diff <= 60) cycleLengths.push(diff);
    }
    const avgCycle = cycleLengths.length
      ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
      : 28;
    // Средняя длительность месячных
    const periodRuns = [];
    let run = 0;
    for (let i = 0; i < sortedPeriods.length; i++) {
      const prev = i > 0 ? sortedPeriods[i - 1] : null;
      if (prev && differenceInCalendarDays(parseDay(sortedPeriods[i]), parseDay(prev)) === 1) {
        run++;
      } else {
        if (run > 0) periodRuns.push(run);
        run = 1;
      }
    }
    if (run > 0) periodRuns.push(run);
    const avgPeriodLen = periodRuns.length
      ? Math.round(periodRuns.reduce((a, b) => a + b, 0) / periodRuns.length)
      : 5;

    const lastStart = periodStarts.length ? periodStarts[periodStarts.length - 1] : null;
    const nextStart = lastStart ? addDays(parseDay(lastStart), avgCycle) : null;
    const daysUntilNext = nextStart ? differenceInCalendarDays(nextStart, new Date()) : null;
    const cycleDayNum = lastStart ? differenceInCalendarDays(new Date(), parseDay(lastStart)) + 1 : null;
    // Предполагаемые дни следующих месячных
    const predictedSet = new Set();
    if (nextStart) {
      for (let i = 0; i < avgPeriodLen; i++) predictedSet.add(format(addDays(nextStart, i), 'yyyy-MM-dd'));
    }
    return { avgCycle, avgPeriodLen, daysUntilNext, cycleDayNum, predictedSet };
  }, [periodDays]);
  const { avgCycle, avgPeriodLen, daysUntilNext, cycleDayNum, predictedSet } = cycleInfo;

  const cycleMonthStart = startOfMonth(cycleMonth);
  const cycleDaysGrid = eachDayOfInterval({ start: cycleMonthStart, end: endOfMonth(cycleMonth) });
  const cyclePad = (getDay(cycleMonthStart) + 6) % 7;

  // Last 30 days for med calendar
  const last30Days = eachDayOfInterval({
    start: subDays(new Date(), 29),
    end: new Date(),
  });

  return (
    <div className="health-page">
      <div className="health-tabs">
        <button className={`tab ${activeTab === 'meds' ? 'active' : ''}`} onClick={() => setActiveTab('meds')}>
          <Pill size={16} /> Лекарства
        </button>
        <button className={`tab ${activeTab === 'dynamics' ? 'active' : ''}`} onClick={() => setActiveTab('dynamics')}>
          <TrendingUp size={16} /> Динамика
        </button>
        <button className={`tab ${activeTab === 'water' ? 'active' : ''}`} onClick={() => setActiveTab('water')}>
          <Droplets size={16} /> Вода
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <Calendar size={16} /> Календарь
        </button>
        <button className={`tab ${activeTab === 'cycle' ? 'active' : ''}`} onClick={() => setActiveTab('cycle')}>
          <Heart size={16} /> Цикл
        </button>
      </div>

      {activeTab === 'meds' && (
        <div className="meds-section">
          <div className="section-header">
            <h2>Приём сегодня</h2>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Добавить препарат
            </button>
          </div>

          {activeMeds.length === 0 ? (
            <div className="empty-state">
              <Pill size={48} />
              <p>Нет активных препаратов</p>
            </div>
          ) : (
            <div className="meds-today">
              {Object.entries(MED_TIMES).map(([timeKey, timeInfo]) => {
                const medsForTime = activeMeds.filter(m => (m.times || []).includes(timeKey));
                if (medsForTime.length === 0) return null;
                const TimeIcon = TIME_ICONS[timeKey];

                return (
                  <div key={timeKey} className="time-slot">
                    <div className="time-slot-header">
                      <TimeIcon size={18} />
                      <span>{timeInfo.emoji} {timeInfo.label}</span>
                    </div>
                    <div className="time-slot-meds">
                      {medsForTime.map(med => {
                        const taken = isTaken(med.id, timeKey);
                        const stats = getMedStats(med);
                        return (
                          <div key={med.id} className={`med-item ${taken ? 'taken' : ''}`}>
                            <button className="check-btn large" onClick={() => markTaken(med.id, timeKey)}>
                              {taken ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                            <div className="med-info">
                              <strong>{med.name}</strong>
                              {med.dosage && <span className="med-dosage">{med.dosage}</span>}
                            </div>
                            <div className="med-item-stats">
                              {stats.streak > 0 && (
                                <span className="med-streak" title="Серия дней подряд">
                                  🔥 {stats.streak} дн.
                                </span>
                              )}
                              {stats.daysSinceStart !== null && (
                                <span className="med-day-count" title="Дней приёма">
                                  📅 День {stats.daysSinceStart}
                                </span>
                              )}
                            </div>
                            {taken && <span className="taken-badge">✅ Принято</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeMeds.length > 0 && (
            <div className="meds-list-section">
              <h3>Все препараты</h3>
              <div className="meds-full-list">
                {activeMeds.map(med => {
                  const stats = getMedStats(med);
                  return (
                    <div key={med.id} className="med-full-card">
                      <div className="med-full-header">
                        <div>
                          <h4><Pill size={14} /> {med.name}</h4>
                          {med.dosage && <span className="med-dosage">{med.dosage}</span>}
                        </div>
                        <div className="med-card-actions">
                          <button className="btn-icon-sm" onClick={() => handleEditMed(med)} title="Изменить">
                            <Edit3 size={14} />
                          </button>
                          <button className="btn-icon-sm" onClick={() => archiveMed(med.id)} title="В архив (курс закончен)">
                            <Archive size={14} />
                          </button>
                          <button className="btn-icon-sm" onClick={() => handleDeleteMed(med.id)} title="Удалить">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="med-schedule">
                        {(med.times || []).map(t => (
                          <span key={t} className="med-time-badge">{MED_TIMES[t]?.emoji} {MED_TIMES[t]?.label}</span>
                        ))}
                        {med.repeatCourse && med.repeatCourse !== 'none' && (
                          <span className="med-time-badge repeat"><RefreshCw size={11} /> {MED_REPEAT[med.repeatCourse]}</span>
                        )}
                        {med.courseCount > 1 && (
                          <span className="med-time-badge">Курс №{med.courseCount}</span>
                        )}
                      </div>

                      {/* Course progress */}
                      {stats.courseProgress !== null && (
                        <div className="med-course-progress">
                          <div className="progress-bar-container">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${stats.courseProgress}%` }} />
                            </div>
                            <span className="progress-text">{stats.courseProgress}%</span>
                          </div>
                        </div>
                      )}

                      {/* Stats mini-row */}
                      <div className="med-stats-row">
                        {stats.daysSinceStart !== null && (
                          <span className="med-stat-badge">
                            <Clock size={12} /> День {stats.daysSinceStart}
                            {stats.courseDuration && <span className="med-stat-sub"> из {stats.courseDuration}</span>}
                          </span>
                        )}
                        {stats.streak > 0 && (
                          <span className="med-stat-badge streak">
                            <Flame size={12} /> Серия: {stats.streak} дн.
                          </span>
                        )}
                        {stats.daysLeft !== null && stats.daysLeft >= 0 && (
                          <span className="med-stat-badge remaining">
                            {stats.daysLeft === 0 ? '⏳ Последний день курса' : `⏳ Осталось: ${stats.daysLeft} дн.`}
                          </span>
                        )}
                      </div>

                      {(med.startDate || med.endDate) && (
                        <div className="med-dates">
                          {med.startDate && <span>С {format(parseDay(med.startDate), 'd MMM', { locale: ru })}</span>}
                          {med.endDate && <span> по {format(parseDay(med.endDate), 'd MMM yyyy', { locale: ru })}</span>}
                        </div>
                      )}
                      {med.notes && <p className="med-notes">{med.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {archivedMeds.length > 0 && (
            <div className="archive-section" style={{ marginTop: '24px' }}>
              <button className="btn-text" onClick={() => setShowArchive(!showArchive)}>
                <Archive size={16} /> Архив лекарств ({archivedMeds.length})
                {showArchive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showArchive && (
                <div className="meds-full-list archived">
                  {archivedMeds.map(med => (
                    <div key={med.id} className="med-full-card archived">
                      <div className="med-full-header">
                        <div>
                          <h4><Pill size={14} /> {med.name}</h4>
                          {med.dosage && <span className="med-dosage">{med.dosage}</span>}
                        </div>
                        <div className="med-card-actions">
                          <button className="btn-icon-sm" onClick={() => resumeMed(med)} title="Возобновить — начать новый курс">
                            <RotateCcw size={14} />
                          </button>
                          <button className="btn-icon-sm" onClick={() => handleDeleteMed(med.id)} title="Удалить">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="med-archived-info">
                        <span>📋 Курсов пройдено: {med.courseCount || 1}</span>
                        {med.repeatCourse && med.repeatCourse !== 'none' && (
                          <span><RefreshCw size={11} /> {MED_REPEAT[med.repeatCourse]}</span>
                        )}
                      </div>
                      {(med.startDate || med.endDate) && (
                        <div className="med-dates">
                          {med.startDate && <span>Последний курс: с {format(parseDay(med.startDate), 'd MMM', { locale: ru })}</span>}
                          {med.endDate && <span> по {format(parseDay(med.endDate), 'd MMM yyyy', { locale: ru })}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DYNAMICS TAB */}
      {activeTab === 'dynamics' && (
        <div className="dynamics-section">
          <h2><TrendingUp size={22} /> Динамика приёма</h2>

          {activeMeds.length === 0 ? (
            <div className="empty-state">
              <TrendingUp size={48} />
              <p>Добавьте препараты для отслеживания динамики</p>
            </div>
          ) : (
            <div className="dynamics-list">
              {activeMeds.map(med => {
                const stats = getMedStats(med);
                const medLogs = healthLog.filter(l => l.medId === med.id);

                return (
                  <div key={med.id} className="dynamics-card">
                    <div className="dynamics-card-header">
                      <h3><Pill size={16} /> {med.name}</h3>
                      {med.dosage && <span className="med-dosage">{med.dosage}</span>}
                    </div>

                    {/* Stats grid */}
                    <div className="dynamics-stats">
                      <div className="dyn-stat">
                        <span className="dyn-stat-value">{stats.daysSinceStart || 0}</span>
                        <span className="dyn-stat-label">Дней курса</span>
                      </div>
                      <div className="dyn-stat">
                        <span className="dyn-stat-value">{stats.totalDaysTaken}</span>
                        <span className="dyn-stat-label">Дней принято</span>
                      </div>
                      <div className="dyn-stat streak-stat">
                        <span className="dyn-stat-value">🔥 {stats.streak}</span>
                        <span className="dyn-stat-label">Дней подряд</span>
                      </div>
                      <div className="dyn-stat">
                        <span className={`dyn-stat-value ${stats.adherenceRate >= 80 ? 'good' : stats.adherenceRate >= 50 ? 'warn' : 'bad'}`}>
                          {stats.adherenceRate}%
                        </span>
                        <span className="dyn-stat-label">Соблюдение</span>
                      </div>
                    </div>

                    {/* Course progress bar */}
                    {stats.courseProgress !== null && (
                      <div className="dynamics-course">
                        <div className="dynamics-course-info">
                          <span>Прогресс курса</span>
                          <span>{stats.daysSinceStart} / {stats.courseDuration} дней</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${stats.courseProgress}%` }} />
                        </div>
                      </div>
                    )}

                    {/* 30-day heatmap */}
                    <div className="dynamics-heatmap">
                      <div className="heatmap-label">Последние 30 дней:</div>
                      <div className="heatmap-grid">
                        {last30Days.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const dayLogs = medLogs.filter(l => l.date === dateStr);
                          const totalRequired = (med.times || []).length;
                          const takenCount = dayLogs.length;
                          const isFuture = day > new Date();
                          const isBeforeStart = med.startDate && day < parseDay(med.startDate);

                          let cls = 'heatmap-cell';
                          if (isFuture || isBeforeStart) cls += ' inactive';
                          else if (takenCount >= totalRequired && totalRequired > 0) cls += ' full';
                          else if (takenCount > 0) cls += ' partial';
                          else cls += ' missed';

                          const isCurrentDay = isSameDay(day, new Date());
                          if (isCurrentDay) cls += ' current';

                          return (
                            <div
                              key={dateStr}
                              className={cls}
                              title={`${format(day, 'd MMM', { locale: ru })}: ${takenCount}/${totalRequired}`}
                            >
                              {isCurrentDay && <span className="current-dot" />}
                            </div>
                          );
                        })}
                      </div>
                      <div className="heatmap-legend">
                        <span><span className="heatmap-cell full mini" /> Полный приём</span>
                        <span><span className="heatmap-cell partial mini" /> Частично</span>
                        <span><span className="heatmap-cell missed mini" /> Пропуск</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'water' && (
        <div className="water-section">
          <div className="water-tracker">
            <h2><Droplets size={24} /> Водный баланс</h2>
            <div className="water-display">
              <div className="water-count">{(waterMl / 1000).toFixed(1).replace('.', ',')} л</div>
              <div className="water-label">{waterMl} мл из {WATER_NORM} мл</div>
              <div className="water-target">цель: {WATER_NORM / 1000} л в день</div>
            </div>
            <div className="water-progress">
              <div className="progress-bar large">
                <div className="progress-fill water" style={{ width: `${Math.min((waterMl / WATER_NORM) * 100, 100)}%` }} />
              </div>
            </div>
            <div className="water-buttons">
              <button className="btn-water minus" onClick={() => addWater(-200)} title="Убрать 200 мл">−</button>
              <button className="btn-water plus" onClick={() => addWater(200)}>+200 мл</button>
              <button className="btn-water plus" onClick={() => addWater(250)}>+250 мл</button>
            </div>

            <div className="water-reminders">
              <label className="water-toggle">
                <input type="checkbox" checked={waterRemindersOn} onChange={e => handleWaterToggle(e.target.checked)} />
                <span>Напоминать пить воду каждый час (9:00–22:00)</span>
              </label>
              <p className="water-hint">
                {waterRemindersOn
                  ? '💧 Уведомления приходят каждый час по графику: стакан 200–250 мл, всего 3 л в день.'
                  : 'Включи, чтобы каждый час приходило push-напоминание выпить воду.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <h2>Календарь приёма (неделя)</h2>
          <div className="med-calendar">
            <div className="med-cal-header">
              <div className="med-cal-name">Препарат</div>
              {last30Days.slice(-7).map(day => (
                <div key={day.toISOString()} className={`med-cal-day ${isSameDay(day, new Date()) ? 'today' : ''}`}>
                  {format(day, 'EEE', { locale: ru })}
                  <br />
                  {format(day, 'd')}
                </div>
              ))}
            </div>
            {activeMeds.map(med => (
              <div key={med.id} className="med-cal-row">
                <div className="med-cal-name">{med.name}</div>
                {last30Days.slice(-7).map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const takenTimes = healthLog.filter(l => l.medId === med.id && l.date === dateStr);
                  const totalRequired = (med.times || []).length;
                  const takenCount = takenTimes.length;

                  return (
                    <div key={day.toISOString()} className={`med-cal-cell ${takenCount >= totalRequired && totalRequired > 0 ? 'full' : takenCount > 0 ? 'partial' : 'missed'}`}>
                      {takenCount > 0 ? `${takenCount}/${totalRequired}` : '—'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'cycle' && (
        <div className="cycle-section">
          <div className="section-header">
            <h2><Heart size={22} /> Календарь цикла</h2>
            <button className="btn-primary" onClick={() => togglePeriodDay(today)}>
              {periodSet.has(today) ? '✓ Сегодня отмечено' : '🩸 Отметить сегодня'}
            </button>
          </div>

          <div className="cycle-stats">
            <div className="cycle-stat">
              <span className="cycle-stat-value">{cycleDayNum ? cycleDayNum : '—'}</span>
              <span className="cycle-stat-label">День цикла</span>
            </div>
            <div className="cycle-stat">
              <span className="cycle-stat-value">
                {daysUntilNext === null ? '—' : daysUntilNext >= 0 ? `~${daysUntilNext}` : 'задержка'}
              </span>
              <span className="cycle-stat-label">{daysUntilNext !== null && daysUntilNext < 0 ? `${Math.abs(daysUntilNext)} дн.` : 'дней до месячных'}</span>
            </div>
            <div className="cycle-stat">
              <span className="cycle-stat-value">{avgCycle}</span>
              <span className="cycle-stat-label">Средний цикл, дн.</span>
            </div>
            <div className="cycle-stat">
              <span className="cycle-stat-value">{avgPeriodLen}</span>
              <span className="cycle-stat-label">Длительность, дн.</span>
            </div>
          </div>

          <div className="cycle-range">
            <div className="cycle-range-field">
              <label>Начало</label>
              <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
            </div>
            <div className="cycle-range-field">
              <label>Конец</label>
              <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
            </div>
            <button className="btn-secondary" onClick={markRange} disabled={!rangeStart}>Отметить период</button>
          </div>

          <div className="calendar-header-bar">
            <button className="btn-icon" onClick={() => setCycleMonth(subMonths(cycleMonth, 1))}><ChevronLeft size={20} /></button>
            <h3>{format(cycleMonth, 'LLLL yyyy', { locale: ru })}</h3>
            <button className="btn-icon" onClick={() => setCycleMonth(addMonths(cycleMonth, 1))}><ChevronRight size={20} /></button>
          </div>

          <div className="calendar-grid cycle-grid">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))}
            {Array.from({ length: cyclePad }, (_, i) => <div key={`pad-${i}`} className="calendar-cell empty" />)}
            {cycleDaysGrid.map(day => {
              const ds = format(day, 'yyyy-MM-dd');
              const isPeriod = periodSet.has(ds);
              const isPredicted = !isPeriod && predictedSet.has(ds);
              return (
                <button
                  key={ds}
                  className={`calendar-cell cycle-cell ${isSameDay(day, new Date()) ? 'today' : ''} ${isPeriod ? 'period' : ''} ${isPredicted ? 'predicted' : ''}`}
                  onClick={() => togglePeriodDay(ds)}
                >
                  <span className="day-number">{format(day, 'd')}</span>
                </button>
              );
            })}
          </div>

          <div className="cycle-legend">
            <span><span className="cycle-dot period" /> Месячные</span>
            <span><span className="cycle-dot predicted" /> Предполагаемые</span>
          </div>
          <p className="cycle-hint">Отмечай дни месячных — приложение посчитает средний цикл и подскажет, когда ждать следующие. Чем больше отметок, тем точнее прогноз.</p>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{resuming ? 'Новый курс: ' + form.name : editId ? 'Редактировать препарат' : 'Добавить препарат'}</h3>
              <button className="btn-icon" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddMed} className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Название</label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Витамин D, Омега-3..." autoFocus />
                </div>
                <div className="form-group">
                  <label>Дозировка</label>
                  <input type="text" value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} placeholder="1 таблетка" />
                </div>
              </div>
              <div className="form-group">
                <label>Время приёма</label>
                <div className="time-selector">
                  {Object.entries(MED_TIMES).map(([key, info]) => (
                    <button
                      key={key} type="button"
                      className={`time-btn ${form.times.includes(key) ? 'active' : ''}`}
                      onClick={() => toggleMedTime(key)}
                    >
                      {info.emoji} {info.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Начало курса</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Конец курса</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Повторять курс</label>
                <select value={form.repeatCourse} onChange={e => setForm({...form, repeatCourse: e.target.value})}>
                  {Object.entries(MED_REPEAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {form.repeatCourse !== 'none' && (
                  <span className="form-hint">Напомню возобновить за 14 дней до следующего курса.</span>
                )}
              </div>
              <div className="form-group">
                <label>Заметки</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Принимать после еды..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Отмена</button>
                <button type="submit" className="btn-primary"><Check size={16} /> {resuming ? 'Начать курс' : editId ? 'Сохранить' : 'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
