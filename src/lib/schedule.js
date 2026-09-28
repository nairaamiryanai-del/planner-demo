// Синхронизация расписаний срабатываний с сервером (для «будильщика»).

// Время срабатывания (unix ms) из даты напоминания, в местном времени устройства.
// Приоритет — отдельное «время напоминания» (remindTime); если его нет, берём время события.
export function reminderFireAt(reminder) {
  if (!reminder.date) return null;
  const time = reminder.remindTime || reminder.time || '09:00';
  const t = new Date(`${reminder.date}T${time}`).getTime();
  return Number.isNaN(t) ? null : t;
}

// Утро (09:00) указанного дня в местном времени — для дедлайнов задач и сроков заказов.
// Понимает и 'yyyy-MM-dd', и старый формат ISO (переводя его в местный день).
export function morningOf(isoDate) {
  if (!isoDate) return null;
  let day = isoDate.slice(0, 10);
  if (isoDate.includes('T')) {
    const d = new Date(isoDate);
    if (!Number.isNaN(d.getTime())) {
      day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  const t = new Date(`${day}T09:00`).getTime();
  return Number.isNaN(t) ? null : t;
}

const DAY_NUM = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

// Ближайшая дата заданного дня недели в заданное время (unix ms), в местном времени.
export function nextWeekdayAt(dayKey, hours, minutes) {
  const target = DAY_NUM[dayKey];
  if (target == null) return null;
  const now = Date.now();
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  let diff = (target - d.getDay() + 7) % 7;
  if (diff === 0 && d.getTime() <= now) diff = 7;
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

// Время «за час до» из строки HH:MM → {hours, minutes}.
export function hourBefore(time) {
  const [h, m] = (time || '12:00').split(':').map(Number);
  let mins = h * 60 + m - 60;
  if (mins < 0) mins = 0;
  return { hours: Math.floor(mins / 60), minutes: mins % 60 };
}

// Часы для приёма лекарств по времени суток.
export const MED_SLOT_HOURS = { morning: [9, 0], afternoon: [14, 0], evening: [19, 0], night: [22, 0] };

// Ближайшее наступление времени (сегодня если ещё не прошло, иначе завтра).
export function dailyAt(hours, minutes) {
  const now = Date.now();
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// Первое срабатывание для курса: ближайшее время приёма, но не раньше начала курса.
export function courseDailyAt(startDate, hours, minutes) {
  let t = dailyAt(hours, minutes);
  if (startDate) {
    const start = new Date(`${startDate}T00:00`);
    start.setHours(hours, minutes, 0, 0);
    if (start.getTime() > t) t = start.getTime();
  }
  return t;
}

// Конец курса как unix ms (конец указанного дня).
export function endOfCourse(endDate) {
  if (!endDate) return null;
  const t = new Date(`${endDate.slice(0, 10)}T23:59`).getTime();
  return Number.isNaN(t) ? null : t;
}

// Дата напоминания «возобновить курс»: начало + N месяцев − warnDays, в будущем.
export function resumeFireAt(startDate, months, warnDays) {
  if (!startDate || !months) return null;
  const base = new Date(`${startDate.slice(0, 10)}T09:00`);
  base.setMonth(base.getMonth() + months);
  base.setDate(base.getDate() - warnDays);
  let t = base.getTime();
  const now = Date.now();
  while (t <= now) {
    const d = new Date(t);
    d.setMonth(d.getMonth() + months);
    t = d.getTime();
  }
  return t;
}

// Часовой пояс устройства — сервер использует его, чтобы правильно считать
// следующее срабатывание повторяющихся напоминаний (месяцы, переходы времени).
export const DEVICE_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
})();

// Шаг повтора на клиенте (та же семантика, что addMonths: 31 января → 28 февраля).
function stepDate(d, repeat) {
  const m = /^m(\d+)$/.exec(repeat);
  const next = new Date(d);
  if (repeat === 'daily') next.setDate(next.getDate() + 1);
  else if (repeat === 'weekly') next.setDate(next.getDate() + 7);
  else if (repeat === 'monthly' || m) {
    const months = m ? Number(m[1]) : 1;
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
  } else if (repeat === 'yearly') {
    const day = next.getDate();
    next.setDate(1);
    next.setFullYear(next.getFullYear() + 1);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
  } else return null;
  return next;
}

// Прошедшее время срабатывания повторяющегося напоминания сдвигаем в будущее,
// чтобы сервер не прислал «догоняющее» уведомление о прошлом.
export function advanceToFuture(fireAt, repeat, repeatUntil) {
  if (!fireAt || !repeat || repeat === 'none') return fireAt;
  const now = Date.now();
  let d = new Date(fireAt);
  let guard = 0;
  while (d.getTime() <= now && guard < 1000) {
    const next = stepDate(d, repeat);
    if (!next) return fireAt;
    d = next;
    guard++;
  }
  const t = d.getTime();
  if (repeatUntil && t > repeatUntil) return null; // повторы уже закончились
  return t;
}

function itemBody(item) {
  return {
    action: 'upsert',
    reminderId: item.id,
    fireAt: item.fireAt,
    title: item.title,
    text: item.text || '',
    repeat: item.repeat || 'none',
    repeatUntil: item.repeatUntil || null,
    url: item.url || '/reminders',
    tz: DEVICE_TZ,
  };
}

async function post(accountId, body) {
  const r = await fetch(`/api/schedule?id=${accountId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    console.warn('schedule request failed:', r.status, body.action);
    throw new Error('schedule-failed');
  }
}

export function pushSchedule(accountId, item) {
  return post(accountId, itemBody(item));
}

export function deleteSchedule(accountId, id) {
  return post(accountId, { action: 'delete', reminderId: id });
}

// Пакетная отправка: все расписания одним запросом (upsert и delete вперемешку;
// delete — это элемент с fireAt: null). Сервер обрабатывает по порядку.
export function pushScheduleBulk(accountId, items) {
  if (!items.length) return Promise.resolve();
  return post(accountId, {
    action: 'bulk',
    items: items.map((it) => (it.fireAt == null
      ? { action: 'delete', reminderId: it.id }
      : itemBody(it))),
  });
}
