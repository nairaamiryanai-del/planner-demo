// ===== Демо-данные =====
// При первом открытии в каждом разделе есть примеры, чтобы было видно, как всё
// работает. Даты считаются от сегодняшнего дня, поэтому демо всегда «живое».
// Свои данные заводятся поверх: примеры можно просто удалить.

const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const iso = (offset) => new Date(Date.now() + offset * 86400000).toISOString();

export const defaultTasks = [
  { id: 'demo-t1', title: 'Подготовить отчёт за месяц', description: 'Собрать цифры и отправить до обеда',
    status: 'todo', priority: 'high', category: 'work', deadline: day(0), tags: ['важно'], createdAt: iso(-3) },
  { id: 'demo-t2', title: 'Записаться к стоматологу', description: '',
    status: 'todo', priority: 'medium', category: 'health', deadline: day(2), tags: [], createdAt: iso(-2) },
  { id: 'demo-t3', title: 'Сверстать лендинг для клиента', description: 'Первый экран и форма заявки',
    status: 'in-progress', priority: 'high', category: 'freelance', deadline: day(4), tags: ['заказ'], createdAt: iso(-5) },
  { id: 'demo-t4', title: 'Купить подарок к празднику', description: '',
    status: 'todo', priority: 'low', category: 'personal', deadline: day(6), tags: [], createdAt: iso(-1) },
  { id: 'demo-t5', title: 'Оплатить секцию', description: '',
    status: 'done', priority: 'medium', category: 'kids', deadline: day(-1), tags: [], createdAt: iso(-6) },
];

export const defaultFreelanceProjects = [
  { id: 'demo-f1', name: 'Посты для соцсетей', client: 'Кофейня «Зерно»', totalUnits: 8, unitName: 'постов',
    doneUnits: 5, unitDates: [day(-9), day(-7), day(-5), day(-3), day(-1), null, null, null],
    price: 12000, startDate: day(-10), deadline: day(7), notes: 'Фото берём из общей папки',
    paid: false, archived: false, createdAt: iso(-10) },
  { id: 'demo-f2', name: 'Дизайн визиток', client: 'Студия йоги', totalUnits: 3, unitName: 'макетов',
    doneUnits: 3, unitDates: [day(-14), day(-12), day(-11)], price: 4500, startDate: day(-15), deadline: day(-10),
    notes: '', paid: true, archived: false, createdAt: iso(-15) },
];

export const defaultChildActivities = [
  { id: 'demo-a1', name: 'Плавание', child: '', day: 'monday', time: '17:00', duration: 60, type: 'sport', location: 'Бассейн', price: 500, paid: false },
  { id: 'demo-a2', name: 'Английский', child: '', day: 'tuesday', time: '16:00', duration: 60, type: 'study', location: '', price: 700, paid: false },
  { id: 'demo-a3', name: 'Рисование', child: '', day: 'wednesday', time: '15:30', duration: 90, type: 'art', location: 'Арт-студия', price: 600, paid: false },
  { id: 'demo-a4', name: 'Плавание', child: '', day: 'thursday', time: '17:00', duration: 60, type: 'sport', location: 'Бассейн', price: 500, paid: false },
  { id: 'demo-a5', name: 'Фортепиано', child: '', day: 'saturday', time: '11:00', duration: 45, type: 'music', location: '', price: 900, paid: false },
];

export const defaultNotes = [
  { id: 'demo-n1', title: 'Идеи для выходных', type: 'text',
    content: 'Парк и пикник, если будет солнце.\nМузей науки, если дождь.', items: [],
    color: 'green', pinned: true, updatedAt: iso(-1), createdAt: iso(-4) },
  { id: 'demo-n2', title: 'Сборы в школу', type: 'checklist', content: '',
    items: [
      { id: 'demo-n2-1', text: 'Тетради', done: true },
      { id: 'demo-n2-2', text: 'Сменная обувь', done: false },
      { id: 'demo-n2-3', text: 'Форма на физкультуру', done: false },
    ],
    color: 'yellow', pinned: false, updatedAt: iso(0), createdAt: iso(-2) },
  { id: 'demo-n3', title: 'Рецепт сырников', type: 'text',
    content: 'Творог 400 г, яйцо, 2 ст. л. муки, щепотка соли. Жарить на среднем огне.', items: [],
    color: 'default', pinned: false, updatedAt: iso(-6), createdAt: iso(-6) },
];

export const defaultGoals = [
  { id: 'demo-g1', title: 'Выучить английский до уровня B2', description: 'Занятия 3 раза в неделю',
    category: 'education', deadline: day(120), completed: false, createdAt: iso(-30),
    steps: [
      { id: 'demo-g1-1', text: 'Пройти тест на уровень', done: true },
      { id: 'demo-g1-2', text: 'Выбрать курс', done: true },
      { id: 'demo-g1-3', text: 'Заниматься 3 месяца без пропусков', done: false },
      { id: 'demo-g1-4', text: 'Сдать пробный экзамен', done: false },
    ] },
  { id: 'demo-g2', title: 'Накопить на отпуск', description: '',
    category: 'finance', deadline: day(60), completed: false, createdAt: iso(-20),
    steps: [
      { id: 'demo-g2-1', text: 'Посчитать бюджет', done: true },
      { id: 'demo-g2-2', text: 'Откладывать 10% дохода', done: false },
    ] },
];

export const defaultReminders = [
  { id: 'demo-r1', title: 'Продлить страховку', description: 'Позвонить в страховую', date: day(0),
    time: '10:00', remindTime: '09:30', category: 'documents', repeat: 'none', createdAt: iso(-3) },
  { id: 'demo-r2', title: 'Оплатить интернет', description: '', date: day(3),
    time: '', remindTime: '', category: 'finance', repeat: 'monthly', createdAt: iso(-40) },
  { id: 'demo-r3', title: 'День рождения подруги', description: 'Заказать цветы', date: day(9),
    time: '', remindTime: '', category: 'personal', repeat: 'yearly', createdAt: iso(-100) },
];

export const defaultTrips = [
  { id: 'demo-tr1', destination: 'Сочи, море', dateFrom: day(21), dateTo: day(28), notes: 'Отель у набережной, трансфер заказан',
    budget: 60000, status: 'planning', createdAt: iso(-7), expenses: [],
    todos: [
      { id: 'demo-tr1-t1', text: 'Купить билеты', done: true },
      { id: 'demo-tr1-t2', text: 'Забронировать отель', done: true },
      { id: 'demo-tr1-t3', text: 'Оформить страховку', done: false },
    ],
    packing: [
      { category: 'clothes', items: [
        { id: 'demo-p1', text: 'Купальник', packed: false },
        { id: 'demo-p2', text: 'Панама', packed: false },
      ] },
      { category: 'medicine', items: [{ id: 'demo-p3', text: 'Солнцезащитный крем', packed: true }] },
      { category: 'documents', items: [{ id: 'demo-p4', text: 'Паспорт', packed: true }] },
      { category: 'tech', items: [{ id: 'demo-p5', text: 'Зарядка', packed: false }] },
      { category: 'kids', items: [] },
      { category: 'other', items: [] },
    ] },
];

export const defaultShoppingLists = [
  { id: 'demo-s1', name: 'Продукты на неделю', archived: false, createdAt: iso(-1),
    items: [
      { id: 'demo-s1-1', text: 'Молоко', category: 'food', quantity: '2', bought: true },
      { id: 'demo-s1-2', text: 'Яблоки', category: 'food', quantity: '1 кг', bought: false },
      { id: 'demo-s1-3', text: 'Средство для посуды', category: 'household', quantity: '1', bought: false },
      { id: 'demo-s1-4', text: 'Витамины', category: 'health', quantity: '1', bought: false },
    ] },
];

export const defaultHealthMeds = [
  { id: 'demo-m1', name: 'Витамин D', dosage: '1 капсула', times: ['morning'], startDate: day(-12), endDate: day(18),
    notes: 'Во время завтрака', repeatCourse: '3', active: true, archived: false, courseCount: 1, createdAt: iso(-12) },
  { id: 'demo-m2', name: 'Магний B6', dosage: '1 таблетка', times: ['evening'], startDate: day(-5), endDate: '',
    notes: '', repeatCourse: 'none', active: true, archived: false, courseCount: 1, createdAt: iso(-5) },
];

// Журнал приёма: витамин D принят последние 5 дней подряд, магний — вчера; вода сегодня
export const defaultHealthLog = [
  ...[-5, -4, -3, -2, -1].map((o) => ({ id: `demo-l-d${o}`, medId: 'demo-m1', time: 'morning', date: day(o), takenAt: iso(o) })),
  { id: 'demo-l-mg', medId: 'demo-m2', time: 'evening', date: day(-1), takenAt: iso(-1) },
  { id: 'demo-l-w', type: 'water', date: day(0), ml: 1250 },
];

// Отметки цикла: два прошлых периода по 5 дней
export const defaultPeriodDays = [
  ...[-40, -39, -38, -37, -36].map(day),
  ...[-12, -11, -10, -9, -8].map(day),
];

// Посещения занятий на прошлой неделе: плавание в понедельник посещено и оплачено,
// английский во вторник посещён (ещё не оплачен), рисование в среду пропущено
const lastMonday = -(((new Date().getDay()) + 6) % 7) - 7;
export const defaultChildAttendance = [
  { id: `demo-a1:${day(lastMonday)}`, activityId: 'demo-a1', date: day(lastMonday), attended: true, paid: true },
  { id: `demo-a2:${day(lastMonday + 1)}`, activityId: 'demo-a2', date: day(lastMonday + 1), attended: true, paid: false },
  { id: `demo-a3:${day(lastMonday + 2)}`, activityId: 'demo-a3', date: day(lastMonday + 2), attended: false, paid: false, missed: true },
];

export const TASK_STATUSES = {
  'todo': { label: 'Запланировано', color: '#5f7d86' },
  'in-progress': { label: 'В работе', color: '#f59e0b' },
  'done': { label: 'Сделано', color: '#10b981' },
};

export const PRIORITIES = {
  high: { label: 'Высокий', color: '#ef4444', emoji: '🔴' },
  medium: { label: 'Средний', color: '#f59e0b', emoji: '🟡' },
  low: { label: 'Низкий', color: '#10b981', emoji: '🟢' },
};

export const CATEGORIES = {
  work: { label: 'Работа', color: '#6366f1', emoji: '💼' },
  personal: { label: 'Личное', color: '#ec4899', emoji: '🏠' },
  freelance: { label: 'Проекты', color: '#8b5cf6', emoji: '💻' },
  kids: { label: 'Дети', color: '#06b6d4', emoji: '👶' },
  health: { label: 'Здоровье', color: '#10b981', emoji: '🏥' },
  travel: { label: 'Поездки', color: '#f97316', emoji: '✈️' },
};

// Категории и варианты повтора напоминаний (используются в «Напоминаниях» и календаре)
export const REMINDER_CATEGORIES = {
  personal: { label: 'Личное', emoji: '🏠', color: '#ec4899' },
  work: { label: 'Работа', emoji: '💼', color: '#6366f1' },
  documents: { label: 'Документы', emoji: '📄', color: '#f59e0b' },
  finance: { label: 'Финансы', emoji: '💰', color: '#10b981' },
  kids: { label: 'Дети', emoji: '👶', color: '#06b6d4' },
  health: { label: 'Здоровье', emoji: '🏥', color: '#ef4444' },
};

export const REPEAT_OPTIONS = {
  none: 'Без повтора',
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  yearly: 'Ежегодно',
};

export const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Пн', full: 'Понедельник' },
  { key: 'tuesday', label: 'Вт', full: 'Вторник' },
  { key: 'wednesday', label: 'Ср', full: 'Среда' },
  { key: 'thursday', label: 'Чт', full: 'Четверг' },
  { key: 'friday', label: 'Пт', full: 'Пятница' },
  { key: 'saturday', label: 'Сб', full: 'Суббота' },
  { key: 'sunday', label: 'Вс', full: 'Воскресенье' },
];

export const ACTIVITY_TYPES = {
  sport: { label: 'Спорт', color: '#ef4444', emoji: '🏃' },
  music: { label: 'Музыка', color: '#8b5cf6', emoji: '🎵' },
  study: { label: 'Учёба', color: '#3b82f6', emoji: '📚' },
  art: { label: 'Творчество', color: '#ec4899', emoji: '🎨' },
  other: { label: 'Другое', color: '#6b7280', emoji: '📌' },
};

export const PACKING_CATEGORIES = {
  clothes: { label: 'Одежда', emoji: '👕' },
  medicine: { label: 'Аптечка', emoji: '💊' },
  documents: { label: 'Документы', emoji: '📄' },
  tech: { label: 'Техника', emoji: '🔌' },
  kids: { label: 'Для детей', emoji: '🧸' },
  other: { label: 'Прочее', emoji: '📦' },
};

export const SHOPPING_CATEGORIES = {
  food: { label: 'Продукты', emoji: '🥦' },
  household: { label: 'Бытовая химия', emoji: '🧴' },
  health: { label: 'Здоровье', emoji: '💊' },
  kids: { label: 'Для детей', emoji: '👶' },
  home: { label: 'Для дома', emoji: '🏠' },
  other: { label: 'Прочее', emoji: '📦' },
};

// График питья воды: [час, мл]. Итого 3000 мл (3 л), 9:00–22:00.
export const WATER_SCHEDULE = [
  [9, 250], [10, 250], [11, 250], [12, 250],
  [13, 200], [14, 200], [15, 200], [16, 200],
  [17, 200], [18, 200], [19, 200], [20, 200], [21, 200], [22, 200],
];
export const WATER_NORM = WATER_SCHEDULE.reduce((s, [, ml]) => s + ml, 0);

export const MED_TIMES = {
  morning: { label: 'Утро', emoji: '🌅' },
  afternoon: { label: 'День', emoji: '☀️' },
  evening: { label: 'Вечер', emoji: '🌆' },
  night: { label: 'Перед сном', emoji: '🌙' },
};
