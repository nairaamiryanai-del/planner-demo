// Единая работа с датами-строками. Раньше `new Date('yyyy-MM-dd')` разбирался
// как полночь UTC, а сравнения шли с точностью до часа: «завтра» показывалось
// как «Сегодня», задача краснела «Просрочено» в сам день дедлайна и т.п.
import { parseISO, startOfDay, differenceInCalendarDays, format } from 'date-fns';

// Дата из строки ('yyyy-MM-dd' или полный ISO) как местная полночь этого дня.
export function parseDay(str) {
  if (!str) return null;
  const d = startOfDay(parseISO(str));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Календарных дней от сегодня: 0 — сегодня, 1 — завтра, отрицательное — прошло.
export function daysUntil(str) {
  const d = parseDay(str);
  if (!d) return null;
  return differenceInCalendarDays(d, new Date());
}

export function isPastDay(str) {
  const n = daysUntil(str);
  return n != null && n < 0;
}

// Сегодняшняя дата строкой. Вызывается в момент действия, а не при рендере:
// вкладка PWA может жить сутками, и «сегодня», посчитанное при рендере, устаревает.
export const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export function daysLabel(n) {
  if (n === 0) return 'Сегодня';
  if (n === 1) return 'Завтра';
  return `${n} дн.`;
}
