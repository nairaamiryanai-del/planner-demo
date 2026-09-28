import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Download, Upload, Cloud, CloudOff, RefreshCw, Check, Menu } from 'lucide-react';
import { useState, useRef } from 'react';
import { usePlanner } from '../context/PlannerContext';
import NotificationButton from './NotificationButton';
import { SYNC_ENABLED } from '../lib/config';

const pageTitles = {
  '/': 'Дашборд',
  '/tasks': 'Задачи',
  '/calendar': 'Календарь',
  '/freelance': 'Проекты',
  '/my-projects': 'Мои проекты',
  '/kids': 'Расписание детей',
  '/travel': 'Поездки',
  '/shopping': 'Список покупок',
  '/notes': 'Заметки',
  '/goals': 'Цели',
  '/reminders': 'Напоминания',
  '/health': 'Здоровье',
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const planner = usePlanner();
  const {
    tasks, notes, goals, reminders, trips,
    shoppingLists, freelanceProjects, childActivities,
    syncStatus,
    setMobileNavOpen,
  } = planner;
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  const title = pageTitles[location.pathname] || 'Planner';

  const today = new Date();
  const dateStr = today.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const syncBadge = {
    syncing: { icon: <RefreshCw size={14} className="spin" />, text: 'Синхронизация…', cls: 'syncing' },
    connecting: { icon: <RefreshCw size={14} className="spin" />, text: 'Подключение…', cls: 'syncing' },
    synced: { icon: <Check size={14} />, text: 'Сохранено в облаке', cls: 'synced' },
    offline: { icon: <CloudOff size={14} />, text: 'Нет сети', cls: 'offline' },
    off: { icon: <Cloud size={14} />, text: '', cls: '' },
  }[syncStatus] || null;

  const q = search.trim().toLowerCase();
  const match = (...fields) => fields.some(f => f && f.toLowerCase().includes(q));
  const results = q ? [
    ...tasks.filter(t => match(t.title, t.description)).map(t => ({ label: '✅ Задача', route: '/tasks', text: t.title })),
    ...notes.filter(n => match(n.title, n.content)).map(n => ({ label: '📝 Заметка', route: '/notes', text: n.title || n.content.slice(0, 50) })),
    ...goals.filter(g => match(g.title, g.description)).map(g => ({ label: '🎯 Цель', route: '/goals', text: g.title })),
    ...reminders.filter(r => match(r.title, r.description)).map(r => ({ label: '🔔 Напоминание', route: '/reminders', text: r.title })),
    ...trips.filter(t => match(t.destination, t.notes)).map(t => ({ label: '✈️ Поездка', route: '/travel', text: t.destination })),
    ...shoppingLists.filter(l => match(l.name) || l.items.some(i => match(i.text))).map(l => ({ label: '🛒 Покупки', route: '/shopping', text: l.name })),
    ...freelanceProjects.filter(p => match(p.name, p.client, p.notes)).map(p => ({ label: '💼 Заказ', route: '/freelance', text: p.name })),
    ...childActivities.filter(a => match(a.name, a.location)).map(a => ({ label: '🧒 Кружок', route: '/kids', text: a.name })),
  ].slice(0, 8) : [];

  const openResult = (route) => {
    navigate(route);
    setSearch('');
  };

  const handleExport = () => {
    const payload = {
      app: 'planner',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        tasks: planner.tasks,
        freelanceProjects: planner.freelanceProjects,
        childActivities: planner.childActivities,
        childAttendance: planner.childAttendance,
        notes: planner.notes,
        goals: planner.goals,
        reminders: planner.reminders,
        trips: planner.trips,
        shoppingLists: planner.shoppingLists,
        healthMeds: planner.healthMeds,
        healthLog: planner.healthLog,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed?.app !== 'planner' || !parsed.data) {
          alert('Это не файл резервной копии планировщика.');
          return;
        }
        if (!window.confirm('Заменить все текущие данные данными из файла? Текущие записи будут перезаписаны.')) return;
        const d = parsed.data;
        const setters = {
          tasks: planner.setTasks,
          freelanceProjects: planner.setFreelanceProjects,
          childActivities: planner.setChildActivities,
          childAttendance: planner.setChildAttendance,
          notes: planner.setNotes,
          goals: planner.setGoals,
          reminders: planner.setReminders,
          trips: planner.setTrips,
          shoppingLists: planner.setShoppingLists,
          healthMeds: planner.setHealthMeds,
          healthLog: planner.setHealthLog,
        };
        Object.entries(setters).forEach(([key, set]) => {
          if (Array.isArray(d[key])) set(d[key]);
        });
        alert('Данные восстановлены из резервной копии.');
      } catch {
        alert('Не удалось прочитать файл. Убедитесь, что это резервная копия планировщика.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="header-burger"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Открыть меню"
        >
          <Menu size={22} />
        </button>
        <div className="header-titles">
          <h1 className="page-title">{title}</h1>
          <span className="header-date">{dateStr}</span>
        </div>
      </div>
      <div className="header-right">
        <div className="search-box global-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск по всему..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
          />
          {q && (
            <div className="search-results">
              {results.length === 0 ? (
                <div className="search-empty">Ничего не найдено</div>
              ) : (
                results.map((r, i) => (
                  <button key={i} className="search-result" onMouseDown={() => openResult(r.route)}>
                    <span className="search-result-type">{r.label}</span>
                    <span className="search-result-text">{r.text}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {syncBadge && syncStatus !== 'off' && (
          <span className={`sync-badge ${syncBadge.cls}`} title={syncBadge.text}>
            {syncBadge.icon}
            <span className="sync-badge-text">{syncBadge.text}</span>
          </span>
        )}
        {SYNC_ENABLED && <NotificationButton />}
        <button className="btn-icon" onClick={handleExport} title="Скачать резервную копию">
          <Download size={18} />
        </button>
        <button className="btn-icon" onClick={() => fileRef.current?.click()} title="Восстановить из копии">
          <Upload size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>
    </header>
  );
}
