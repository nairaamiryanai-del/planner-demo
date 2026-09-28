import { NavLink } from 'react-router-dom';
import { usePlanner } from '../context/PlannerContext';
import {
  LayoutDashboard, CheckSquare, Calendar, Briefcase, Baby,
  Plane, ShoppingCart, StickyNote, Target, Bell, Heart,
  ChevronLeft, ChevronRight, FolderGit2
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/tasks', icon: CheckSquare, label: 'Задачи' },
  { to: '/calendar', icon: Calendar, label: 'Календарь' },
  { to: '/freelance', icon: Briefcase, label: 'Проекты' },
  { to: '/my-projects', icon: FolderGit2, label: 'Мои проекты' },
  { to: '/kids', icon: Baby, label: 'Дети' },
  { to: '/travel', icon: Plane, label: 'Поездки' },
  { to: '/shopping', icon: ShoppingCart, label: 'Покупки' },
  { to: '/notes', icon: StickyNote, label: 'Заметки' },
  { to: '/goals', icon: Target, label: 'Цели' },
  { to: '/reminders', icon: Bell, label: 'Напоминания' },
  { to: '/health', icon: Heart, label: 'Здоровье' },
];

export default function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, mobileNavOpen, setMobileNavOpen } = usePlanner();
  // В выдвижном меню на телефоне подписи показываем всегда, даже если на ПК меню свёрнуто
  const collapsed = sidebarCollapsed && !mobileNavOpen;

  return (
    <>
    <div
      className={`sidebar-backdrop ${mobileNavOpen ? 'open' : ''}`}
      onClick={() => setMobileNavOpen(false)}
    />
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileNavOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-logo">
            <span className="logo-icon">📋</span>
            <span className="logo-text">Planner</span>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? label : undefined}
            onClick={() => setMobileNavOpen(false)}
          >
            <Icon size={20} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">Д</div>
            <span className="user-name">Демо</span>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
