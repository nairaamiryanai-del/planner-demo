// Справочный список проектов (только для чтения, редактируется здесь в коде).
// В демо-версии — вымышленные примеры, чтобы было видно, как работает раздел.

// Порядок и цвета стадий
export const STAGE_ORDER = ['готово', 'рабочий прототип', 'каркас', 'ТЗ', 'идея'];
export const STAGE_COLORS = {
  'готово': '#4f8a5a',
  'рабочий прототип': '#c9923f',
  'каркас': '#7e9bab',
  'ТЗ': '#8a6b86',
  'идея': '#a8a59a',
};

export const MY_PROJECTS = [
  { name: 'Planner (этот проект)', where: 'Projects\\planner',
    purpose: 'Личный планировщик-дашборд: задачи, календарь, проекты, дети, покупки, заметки, цели, напоминания, здоровье. Push-уведомления и шифрованная облачная синхронизация.',
    stack: 'React + Vite, PWA, Upstash Redis, web-push', stage: 'готово', date: '28.09.2026' },
  { name: 'Сайт-визитка', where: 'Projects\\portfolio-site',
    purpose: 'Одностраничный сайт с портфолио и формой обратной связи.',
    stack: 'HTML/CSS/JS, Vercel', stage: 'готово', date: '12.08.2026' },
  { name: 'Telegram-бот напоминаний', where: 'Projects\\reminder-bot',
    purpose: 'Бот присылает напоминания по расписанию и принимает задачи текстом.',
    stack: 'Python, aiogram, APScheduler', stage: 'рабочий прототип', date: '03.09.2026' },
  { name: 'Дашборд продаж', where: 'Projects\\sales-dashboard',
    purpose: 'Загрузка выгрузки из Excel даёт графики продаж и ABC-анализ.',
    stack: 'Streamlit, pandas, plotly', stage: 'рабочий прототип', date: '21.09.2026' },
  { name: 'Каталог товаров', where: 'Projects\\catalog',
    purpose: 'Интерактивный прайс-лист с поиском и фильтрами.',
    stack: 'Next.js, Tailwind', stage: 'каркас', date: '15.09.2026' },
  { name: 'ИИ-ассистент по документам', where: 'Projects\\docs-assistant',
    purpose: 'Отвечает на вопросы по базе документов со ссылками на источники (RAG).',
    stack: 'Python, FastAPI, эмбеддинги', stage: 'ТЗ', date: '01.09.2026' },
  { name: 'Трекер привычек', where: 'Projects\\habits',
    purpose: 'Мини-приложение: отметки привычек по дням и серии.',
    stack: 'React, localStorage', stage: 'идея', date: '25.09.2026' },
];
