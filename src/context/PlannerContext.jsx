import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { addDays, addWeeks, addMonths, addYears, startOfDay, parseISO, format } from 'date-fns';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { deriveAccount, encryptJSON, decryptJSON, cloudLoad, cloudSave } from '../lib/sync';
import { pushSupported, enablePush, sendTestPush } from '../lib/push';
import { pushSchedule, deleteSchedule, pushScheduleBulk, advanceToFuture, reminderFireAt, morningOf, nextWeekdayAt, hourBefore, dailyAt, MED_SLOT_HOURS, courseDailyAt, endOfCourse, resumeFireAt } from '../lib/schedule';
import { WATER_SCHEDULE } from '../data/defaultData';

const RESUME_WARN_DAYS = 14; // за сколько дней предупреждать о возобновлении курса

const MED_SLOTS = Object.keys(MED_SLOT_HOURS); // morning/afternoon/evening/night
import LockScreen from '../components/LockScreen';
import { SYNC_ENABLED } from '../lib/config';
import {
  defaultTasks,
  defaultFreelanceProjects,
  defaultChildActivities,
  defaultNotes,
  defaultGoals,
  defaultReminders,
  defaultTrips,
  defaultShoppingLists,
  defaultHealthMeds,
  defaultHealthLog,
  defaultPeriodDays,
  defaultChildAttendance,
} from '../data/defaultData';

// Версия набора данных: при её смене локальные данные сбрасываются к демо-примерам
const DATA_VERSION = 'demo-1';
if (localStorage.getItem('planner-version') !== DATA_VERSION) {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('planner-'))
    .forEach((key) => localStorage.removeItem(key));
  localStorage.setItem('planner-version', DATA_VERSION);
}

// Шаг повтора напоминаний
const REPEAT_STEP = {
  daily: addDays,
  weekly: addWeeks,
  monthly: addMonths,
  yearly: addYears,
};

const PlannerContext = createContext(null);

export function PlannerProvider({ children }) {
  const [tasks, setTasks] = useLocalStorage('planner-tasks', defaultTasks);
  const [freelanceProjects, setFreelanceProjects] = useLocalStorage('planner-freelance', defaultFreelanceProjects);
  const [childActivities, setChildActivities] = useLocalStorage('planner-child-activities', defaultChildActivities);
  const [childAttendance, setChildAttendance] = useLocalStorage('planner-child-attendance', defaultChildAttendance);
  const [notes, setNotes] = useLocalStorage('planner-notes', defaultNotes);
  const [goals, setGoals] = useLocalStorage('planner-goals', defaultGoals);
  const [reminders, setReminders] = useLocalStorage('planner-reminders', defaultReminders);
  const [trips, setTrips] = useLocalStorage('planner-trips', defaultTrips);
  const [shoppingLists, setShoppingLists] = useLocalStorage('planner-shopping', defaultShoppingLists);
  const [healthMeds, setHealthMeds] = useLocalStorage('planner-health-meds', defaultHealthMeds);
  const [healthLog, setHealthLog] = useLocalStorage('planner-health-log', defaultHealthLog);
  const [periodDays, setPeriodDays] = useLocalStorage('planner-period-days', defaultPeriodDays);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage('planner-sidebar', false);
  const [waterRemindersOn, setWaterRemindersOn] = useLocalStorage('planner-water-on', false);
  // Выдвижное меню на телефоне (не сохраняем — всегда стартует закрытым)
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ===== Облачная синхронизация =====
  // Все наборы данных, которые уезжают в облако (без UI-настроек вроде сайдбара).
  const stores = {
    tasks: [tasks, setTasks],
    freelanceProjects: [freelanceProjects, setFreelanceProjects],
    childActivities: [childActivities, setChildActivities],
    childAttendance: [childAttendance, setChildAttendance],
    notes: [notes, setNotes],
    goals: [goals, setGoals],
    reminders: [reminders, setReminders],
    trips: [trips, setTrips],
    shoppingLists: [shoppingLists, setShoppingLists],
    healthMeds: [healthMeds, setHealthMeds],
    healthLog: [healthLog, setHealthLog],
    periodDays: [periodDays, setPeriodDays],
  };
  const storesRef = useRef(stores);
  storesRef.current = stores;

  const collectData = () => {
    const out = {};
    for (const [key, [value]] of Object.entries(storesRef.current)) out[key] = value;
    return out;
  };
  const applyData = (data) => {
    if (!data || typeof data !== 'object') return;
    for (const [key, [, setter]] of Object.entries(storesRef.current)) {
      if (Array.isArray(data[key])) setter(data[key]);
    }
  };

  // В демо-режиме (без сервера) кодовое слово не используется
  const [codeWord, setCodeWord] = useState(() => (SYNC_ENABLED ? localStorage.getItem('planner-codeword') || '' : ''));
  const [skipSync, setSkipSync] = useState(() => localStorage.getItem('planner-skip-sync') === '1');
  const [syncStatus, setSyncStatus] = useState(codeWord ? 'connecting' : 'off'); // off|connecting|syncing|synced|offline
  const [lastSync, setLastSync] = useState(null);

  const accountRef = useRef(null);   // { accountId, key }
  const hydratedRef = useRef(false); // первичная загрузка из облака завершена
  const suppressPushRef = useRef(false); // не отправлять данные, только что пришедшие из облака
  const pushTimerRef = useRef(null);
  const dirtyRef = useRef(false);    // есть правки, ещё не сохранённые в облако
  const resyncedRef = useRef(false); // расписания уведомлений уже пересинхронизированы
  const batchRef = useRef(null);     // сборник для пакетной отправки расписаний

  // Немедленная отправка несохранённых правок в облако (без задержки).
  const pushNow = useCallback(async ({ keepalive = false } = {}) => {
    const account = accountRef.current;
    if (!account) return false;
    if (!dirtyRef.current) return true;
    if (pushTimerRef.current) { clearTimeout(pushTimerRef.current); pushTimerRef.current = null; }
    try {
      setSyncStatus('syncing');
      const blob = await encryptJSON(collectData(), account.key);
      await cloudSave(account.accountId, blob, { keepalive });
      dirtyRef.current = false;
      setSyncStatus('synced');
      setLastSync(Date.now());
      return true;
    } catch {
      setSyncStatus('offline');
      return false;
    }
  }, []);

  // Объединение облачных данных с локальными правками, сделанными до первой
  // успешной загрузки (редкий случай: старт без сети). Локальная версия записи
  // побеждает, облачные записи, которых нет локально, сохраняются.
  const mergeData = (remote) => {
    const merged = {};
    for (const [key, [local]] of Object.entries(storesRef.current)) {
      const rem = Array.isArray(remote?.[key]) ? remote[key] : null;
      if (!rem) { merged[key] = local; continue; }
      if (!Array.isArray(local) || local.length === 0) { merged[key] = rem; continue; }
      const isObjects = typeof (local[0] ?? rem[0]) === 'object';
      if (isObjects) {
        const byId = new Map();
        rem.forEach((it) => { if (it && it.id != null) byId.set(it.id, it); });
        local.forEach((it) => { if (it && it.id != null) byId.set(it.id, it); });
        merged[key] = [...byId.values()];
      } else {
        merged[key] = [...new Set([...rem, ...local])];
      }
    }
    return merged;
  };

  const pull = useCallback(async () => {
    const account = accountRef.current;
    if (!account) return false;
    // Есть несохранённые правки — сначала спасаем их, а не затираем облачными.
    if (dirtyRef.current && hydratedRef.current) return pushNow();
    setSyncStatus('syncing');
    try {
      const remote = await cloudLoad(account.accountId);
      if (remote && remote.blob) {
        const data = await decryptJSON(remote.blob, account.key);
        if (dirtyRef.current) {
          const merged = mergeData(data);
          suppressPushRef.current = true;
          applyData(merged);
          hydratedRef.current = true;
          const blob = await encryptJSON(merged, account.key);
          await cloudSave(account.accountId, blob);
          dirtyRef.current = false;
        } else {
          suppressPushRef.current = true;
          applyData(data);
          hydratedRef.current = true;
        }
      } else {
        // Аккаунт пустой (первый вход) — отправляем текущие локальные данные.
        const blob = await encryptJSON(collectData(), account.key);
        await cloudSave(account.accountId, blob);
        hydratedRef.current = true;
        dirtyRef.current = false;
      }
      setSyncStatus('synced');
      setLastSync(Date.now());
      return true;
    } catch {
      // Не помечаем как загруженное: иначе первая же правка перезапишет облако
      // устаревшими данными этого устройства. Повторим при возврате сети.
      setSyncStatus('offline');
      return false;
    }
  }, [pushNow]);

  const signIn = useCallback(async (word) => {
    const w = word.trim();
    if (!w) return;
    const account = await deriveAccount(w);
    accountRef.current = account;
    hydratedRef.current = false;
    dirtyRef.current = false;
    resyncedRef.current = false;
    const ok = await pull();
    if (!ok) {
      // Не удалось подключиться — не запоминаем слово, экран входа покажет ошибку.
      accountRef.current = null;
      throw new Error('offline');
    }
    localStorage.setItem('planner-codeword', w);
    localStorage.removeItem('planner-skip-sync');
    setSkipSync(false);
    setCodeWord(w);
  }, [pull]);

  const continueWithoutSync = useCallback(() => {
    localStorage.setItem('planner-skip-sync', '1');
    setSkipSync(true);
  }, []);

  // ===== Push-уведомления =====
  const [pushState, setPushState] = useState(() =>
    pushSupported() ? Notification.permission : 'unsupported'
  );

  const enableNotifications = useCallback(async () => {
    if (!accountRef.current) throw new Error('no-account');
    try {
      const devices = await enablePush(accountRef.current.accountId);
      setPushState('granted');
      return devices;
    } catch (e) {
      // Обновляем иконку и после отказа в разрешении
      if (pushSupported()) setPushState(Notification.permission);
      throw e;
    }
  }, []);

  const sendTestNotification = useCallback(async () => {
    if (!accountRef.current) throw new Error('no-account');
    return sendTestPush(accountRef.current.accountId);
  }, []);

  // Планирование любого срабатывания на сервере (для уведомлений по времени).
  // Прошедшие разовые срабатывания удаляем, а не ставим заново: иначе сервер
  // присылал пачку «догоняющих» уведомлений при каждом открытии приложения.
  const scheduleItem = useCallback(async (id, fireAt, title, text, repeat, repeatUntil, url) => {
    if (!accountRef.current) return;
    let at = fireAt;
    if (at != null) {
      if (repeat && repeat !== 'none') at = advanceToFuture(at, repeat, repeatUntil);
      else if (at < Date.now() - 60000) at = null;
    }
    const item = { id, fireAt: at, title, text, repeat, repeatUntil, url };
    if (batchRef.current) { batchRef.current.push(item); return; }
    try {
      if (at == null) await deleteSchedule(accountRef.current.accountId, id);
      else await pushSchedule(accountRef.current.accountId, item);
    } catch { /* офлайн */ }
  }, []);

  const removeSchedule = useCallback((id) => scheduleItem(id, null), [scheduleItem]);

  const scheduleReminder = useCallback((reminder) => {
    return scheduleItem(reminder.id, reminderFireAt(reminder), '🔔 ' + reminder.title, reminder.description || '', reminder.repeat || 'none', null, '/reminders');
  }, [scheduleItem]);
  const unscheduleReminder = removeSchedule;

  const scheduleTask = useCallback((task) => {
    const fireAt = (task.status === 'done' || !task.deadline) ? null : morningOf(task.deadline);
    return scheduleItem(task.id, fireAt, '📋 Дедлайн: ' + task.title, task.description || '', 'none', null, '/tasks');
  }, [scheduleItem]);

  const scheduleProject = useCallback((project) => {
    const fireAt = (project.paid || project.archived || !project.deadline) ? null : morningOf(project.deadline);
    return scheduleItem(project.id, fireAt, '💼 Срок заказа: ' + project.name, project.notes || '', 'none', null, '/freelance');
  }, [scheduleItem]);

  // Занятие ребёнка: два еженедельных напоминания — утром и за час до.
  const scheduleActivity = useCallback((activity) => {
    const info = `${activity.child || 'Ребёнок'}, ${activity.time}${activity.location ? ', ' + activity.location : ''}`;
    const morning = nextWeekdayAt(activity.day, 8, 0);
    const hb = hourBefore(activity.time);
    const before = nextWeekdayAt(activity.day, hb.hours, hb.minutes);
    scheduleItem(`${activity.id}:m`, morning, '🧒 Сегодня: ' + activity.name, info, 'weekly', null, '/kids');
    scheduleItem(`${activity.id}:h`, before, '🧒 Через час: ' + activity.name, info, 'weekly', null, '/kids');
  }, [scheduleItem]);

  const unscheduleActivity = useCallback((id) => {
    removeSchedule(`${id}:m`);
    removeSchedule(`${id}:h`);
  }, [removeSchedule]);

  // Лекарство: ежедневные напоминания на приёмы в пределах курса (start–end),
  // плюс напоминание «возобновить» за 14 дней до следующего цикла (если курс периодический).
  const scheduleMed = useCallback(async (med) => {
    // Сначала дожидаемся удаления старых слотов и только потом ставим новые:
    // иначе удаление может добраться до сервера позже создания и стереть напоминание.
    await Promise.all([
      ...MED_SLOTS.map((slot) => removeSchedule(`${med.id}:${slot}`)),
      removeSchedule(`${med.id}:resume`),
    ]);
    if (med.active === false) return;

    // Напоминание «возобновить» ставим даже для архивного курса (курс закрыт, но нужно
    // вернуться к нему через N месяцев). Отсчёт от даты окончания курса, иначе от начала.
    const months = (med.repeatCourse && med.repeatCourse !== 'none') ? Number(med.repeatCourse) : 0;
    const base = med.endDate || med.startDate;
    if (months && base) {
      const fireAt = resumeFireAt(base, months, RESUME_WARN_DAYS);
      if (fireAt) {
        scheduleItem(`${med.id}:resume`, fireAt, '🔁 Возобновить приём: ' + med.name, 'Пора снова начать курс', 'm' + months, null, '/health');
      }
    }

    // Ежедневные напоминания о приёме — только для активного (не архивного) курса.
    if (med.archived) return;
    const until = endOfCourse(med.endDate);
    (med.times || []).forEach((slot) => {
      const hm = MED_SLOT_HOURS[slot];
      if (!hm) return;
      const fireAt = courseDailyAt(med.startDate, hm[0], hm[1]);
      if (until && fireAt > until) return; // курс уже закончился
      scheduleItem(`${med.id}:${slot}`, fireAt, '💊 Выпить: ' + med.name, med.dosage || '', 'daily', until, '/health');
    });
  }, [scheduleItem, removeSchedule]);

  const unscheduleMed = useCallback((medId) => {
    MED_SLOTS.forEach((slot) => removeSchedule(`${medId}:${slot}`));
    removeSchedule(`${medId}:resume`);
  }, [removeSchedule]);

  // Вода: ежедневные напоминания по графику (каждый час 9:00–22:00).
  const scheduleWater = useCallback((on) => {
    WATER_SCHEDULE.forEach(([h, ml]) => {
      const id = `water:${h}`;
      if (on) scheduleItem(id, dailyAt(h, 0), '💧 Пора выпить воду', `${ml} мл`, 'daily', null, '/health');
      else removeSchedule(id);
    });
  }, [scheduleItem, removeSchedule]);

  const toggleWaterReminders = useCallback((on) => {
    setWaterRemindersOn(on);
    scheduleWater(on);
  }, [scheduleWater, setWaterRemindersOn]);

  // Повторяющиеся напоминания: прошедшие даты переносим на следующее повторение.
  const advanceReminderDates = useCallback(() => {
    const [rems, setRems] = storesRef.current.reminders;
    const today = startOfDay(new Date());
    let changed = false;
    const advanced = rems.map((r) => {
      const step = REPEAT_STEP[r.repeat];
      if (!r.date || !step) return r;
      let d = startOfDay(parseISO(r.date));
      if (Number.isNaN(d.getTime()) || d >= today) return r;
      while (d < today) d = step(d, 1);
      changed = true;
      return { ...r, date: format(d, 'yyyy-MM-dd') };
    });
    if (changed) setRems(advanced);
  }, []);

  // Разовая пересинхронизация всех расписаний с «будильщиком» ПОСЛЕ первой
  // успешной загрузки из облака (по свежим данным, одним пакетным запросом),
  // чтобы напоминали и записи, созданные на других устройствах.
  useEffect(() => {
    if (!lastSync || resyncedRef.current || !accountRef.current) return;
    resyncedRef.current = true;
    advanceReminderDates();
    (async () => {
      const batch = [];
      batchRef.current = batch;
      try {
        const data = collectData();
        (data.reminders || []).forEach(scheduleReminder);
        (data.tasks || []).forEach(scheduleTask);
        (data.freelanceProjects || []).forEach(scheduleProject);
        (data.childActivities || []).forEach(scheduleActivity);
        for (const med of data.healthMeds || []) await scheduleMed(med);
        if (waterRemindersOn) scheduleWater(true);
      } finally {
        batchRef.current = null;
      }
      try {
        await pushScheduleBulk(accountRef.current.accountId, batch);
      } catch {
        resyncedRef.current = false; // офлайн — попробуем после следующей загрузки
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSync]);

  const signOut = useCallback(() => {
    if (pushTimerRef.current) { clearTimeout(pushTimerRef.current); pushTimerRef.current = null; }
    accountRef.current = null;
    hydratedRef.current = false;
    dirtyRef.current = false;
    resyncedRef.current = false;
    localStorage.removeItem('planner-codeword');
    setCodeWord('');
    setSyncStatus('off');
    setLastSync(null);
  }, []);

  // Первичный вход при загрузке, если кодовое слово уже сохранено.
  useEffect(() => {
    if (!codeWord) return;
    let cancelled = false;
    (async () => {
      const account = await deriveAccount(codeWord);
      if (cancelled) return;
      accountRef.current = account;
      await pull();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Отправка изменений в облако (с задержкой, чтобы не слать на каждый штрих).
  useEffect(() => {
    if (!accountRef.current) return;
    if (suppressPushRef.current) { suppressPushRef.current = false; return; }
    dirtyRef.current = true;
    if (!hydratedRef.current) return; // до первой загрузки не отправляем — объединим при загрузке
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => { pushTimerRef.current = null; pushNow(); }, 1200);
    return () => { if (pushTimerRef.current) clearTimeout(pushTimerRef.current); };
  }, [tasks, freelanceProjects, childActivities, childAttendance, notes, goals, reminders, trips, shoppingLists, healthMeds, healthLog, periodDays, pushNow]);

  // Сворачивание — сразу спасаем несохранённое; возврат — подтягиваем свежее;
  // появление сети — догоняем то, что не ушло в офлайне.
  useEffect(() => {
    const onVisibility = () => {
      if (!accountRef.current) return;
      if (document.visibilityState === 'hidden') {
        if (dirtyRef.current && hydratedRef.current) pushNow({ keepalive: true });
      } else if (document.visibilityState === 'visible') {
        pull();
      }
    };
    const onPageHide = () => {
      if (accountRef.current && dirtyRef.current && hydratedRef.current) pushNow({ keepalive: true });
    };
    const onOnline = () => {
      if (!accountRef.current) return;
      if (!hydratedRef.current) pull();
      else if (dirtyRef.current) pushNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
    };
  }, [pull, pushNow]);

  // Без синхронизации переносим прошедшие повторы сразу при открытии
  // (с синхронизацией это происходит после загрузки из облака).
  useEffect(() => {
    if (!codeWord) advanceReminderDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useMemo, чтобы смена мелкого состояния (статус синхронизации, меню)
  // не пересоздавала объект контекста и не перерисовывала всё дерево лишний раз.
  const value = useMemo(() => ({
    tasks, setTasks,
    freelanceProjects, setFreelanceProjects,
    childActivities, setChildActivities,
    childAttendance, setChildAttendance,
    notes, setNotes,
    goals, setGoals,
    reminders, setReminders,
    trips, setTrips,
    shoppingLists, setShoppingLists,
    healthMeds, setHealthMeds,
    healthLog, setHealthLog,
    periodDays, setPeriodDays,
    sidebarCollapsed, setSidebarCollapsed,
    mobileNavOpen, setMobileNavOpen,
    syncStatus, lastSync, codeWord, signOut,
    pushState, enableNotifications, sendTestNotification,
    scheduleReminder, unscheduleReminder, scheduleTask, scheduleProject, removeSchedule,
    scheduleActivity, unscheduleActivity, scheduleMed, unscheduleMed,
    waterRemindersOn, toggleWaterReminders,
  }), [
    tasks, setTasks, freelanceProjects, setFreelanceProjects, childActivities, setChildActivities,
    childAttendance, setChildAttendance,
    notes, setNotes, goals, setGoals, reminders, setReminders, trips, setTrips,
    shoppingLists, setShoppingLists, healthMeds, setHealthMeds, healthLog, setHealthLog,
    periodDays, setPeriodDays, sidebarCollapsed, setSidebarCollapsed, mobileNavOpen,
    syncStatus, lastSync, codeWord, signOut, pushState, enableNotifications, sendTestNotification,
    scheduleReminder, unscheduleReminder, scheduleTask, scheduleProject, removeSchedule,
    scheduleActivity, unscheduleActivity, scheduleMed, unscheduleMed,
    waterRemindersOn, toggleWaterReminders,
  ]);

  const showLock = SYNC_ENABLED && !codeWord && !skipSync;

  return (
    <PlannerContext.Provider value={value}>
      {children}
      {showLock && <LockScreen onSignIn={signIn} onSkip={continueWithoutSync} />}
    </PlannerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error('usePlanner must be used within PlannerProvider');
  }
  return context;
}
