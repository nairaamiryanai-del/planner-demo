import { usePlanner } from '../context/PlannerContext';
import { PRIORITIES, TASK_STATUSES } from '../data/defaultData';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { parseDay, daysUntil, daysLabel, todayStr } from '../lib/dates';
import {
  CheckSquare, Briefcase, Plane,
  Heart, Target, Bell, Clock, TrendingUp, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StatsWidget() {
  const {
    tasks, freelanceProjects, trips,
    goals, reminders, healthMeds, healthLog
  } = usePlanner();

  const today = todayStr();

  // Tasks stats
  const tasksInProgress = tasks.filter(t => t.status === 'in-progress').length;
  const tasksTodo = tasks.filter(t => t.status === 'todo').length;
  const overdueTasks = tasks.filter(t =>
    t.deadline && daysUntil(t.deadline) < 0 && t.status !== 'done'
  );

  // Upcoming deadlines
  const upcomingTasks = tasks
    .filter(t => t.deadline && daysUntil(t.deadline) >= 0 && t.status !== 'done')
    .sort((a, b) => parseDay(a.deadline) - parseDay(b.deadline))
    .slice(0, 5);

  // Freelance
  const activeProjects = freelanceProjects.filter(p => !p.archived && p.doneUnits < p.totalUnits).length;

  // Goals
  const activeGoals = goals.filter(g => !g.completed).length;

  // Reminders
  const upcomingReminders = reminders
    .filter(r => {
      const n = r.date ? daysUntil(r.date) : null;
      return n != null && n >= 0 && n <= 7;
    })
    .sort((a, b) => parseDay(a.date) - parseDay(b.date));

  // Health: архивные курсы не считаем (как в разделе «Здоровье»)
  const activeMeds = healthMeds.filter(m => m.active && !m.archived);
  const todayMedLogs = healthLog.filter(l => l.date === today && l.medId);
  const totalMedSlots = activeMeds.reduce((s, m) => s + (m.times || []).length, 0);
  const medsTaken = todayMedLogs.length;

  // Trips
  const upcomingTrips = trips.filter(t => t.dateFrom && daysUntil(t.dateFrom) >= 0);

  return (
    <div className="dashboard-page">
      <div className="greeting">
        <h2>Привет! 👋</h2>
        <p>{format(new Date(), 'EEEE, d MMMM yyyy', { locale: ru })}</p>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <Link to="/tasks" className="quick-stat-card">
          <CheckSquare size={24} className="stat-icon blue" />
          <div className="stat-data">
            <span className="stat-number">{tasksTodo + tasksInProgress}</span>
            <span className="stat-desc">Активных задач</span>
          </div>
        </Link>

        <Link to="/freelance" className="quick-stat-card">
          <Briefcase size={24} className="stat-icon purple" />
          <div className="stat-data">
            <span className="stat-number">{activeProjects}</span>
            <span className="stat-desc">Проектов в работе</span>
          </div>
        </Link>

        <Link to="/goals" className="quick-stat-card">
          <Target size={24} className="stat-icon green" />
          <div className="stat-data">
            <span className="stat-number">{activeGoals}</span>
            <span className="stat-desc">Активных целей</span>
          </div>
        </Link>

        <Link to="/health" className="quick-stat-card">
          <Heart size={24} className="stat-icon red" />
          <div className="stat-data">
            <span className="stat-number">{medsTaken}/{totalMedSlots}</span>
            <span className="stat-desc">Лекарств принято</span>
          </div>
        </Link>
      </div>

      <div className="dashboard-grid">
        {/* Overdue */}
        {overdueTasks.length > 0 && (
          <div className="dashboard-card alert-card">
            <h3><AlertCircle size={18} /> Просрочено ({overdueTasks.length})</h3>
            <div className="mini-list">
              {overdueTasks.slice(0, 4).map(t => (
                <div key={t.id} className="mini-item overdue">
                  <span className="priority-dot" style={{ background: PRIORITIES[t.priority]?.color }} />
                  <span>{t.title}</span>
                  <span className="mini-date">{format(parseDay(t.deadline), 'd MMM', { locale: ru })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming tasks */}
        <div className="dashboard-card">
          <h3><Clock size={18} /> Ближайшие задачи</h3>
          {upcomingTasks.length === 0 ? (
            <p className="empty-text">Нет предстоящих задач</p>
          ) : (
            <div className="mini-list">
              {upcomingTasks.map(t => {
                const daysLeft = daysUntil(t.deadline);
                return (
                  <div key={t.id} className="mini-item">
                    <span className="priority-dot" style={{ background: PRIORITIES[t.priority]?.color }} />
                    <span>{t.title}</span>
                    <span className={`mini-date ${daysLeft <= 2 ? 'urgent' : ''}`}>
                      {daysLabel(daysLeft)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reminders */}
        {upcomingReminders.length > 0 && (
          <div className="dashboard-card">
            <h3><Bell size={18} /> Напоминания (7 дней)</h3>
            <div className="mini-list">
              {upcomingReminders.map(r => {
                const daysLeft = daysUntil(r.date);
                return (
                  <div key={r.id} className="mini-item">
                    <span className="reminder-indicator" />
                    <span>{r.title}</span>
                    <span className={`mini-date ${daysLeft <= 1 ? 'urgent' : ''}`}>
                      {daysLeft === 0 ? 'Сегодня!' : daysLabel(daysLeft)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Trips */}
        {upcomingTrips.length > 0 && (
          <div className="dashboard-card">
            <h3><Plane size={18} /> Ближайшие поездки</h3>
            <div className="mini-list">
              {upcomingTrips.map(trip => {
                const daysLeft = daysUntil(trip.dateFrom);
                return (
                  <div key={trip.id} className="mini-item">
                    <span>✈️ {trip.destination}</span>
                    <span className="mini-date">{daysLabel(daysLeft)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Task Progress */}
        <div className="dashboard-card">
          <h3><TrendingUp size={18} /> Прогресс задач</h3>
          <div className="task-progress-chart">
            {Object.entries(TASK_STATUSES).map(([key, status]) => {
              const count = tasks.filter(t => t.status === key).length;
              const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
              return (
                <div key={key} className="progress-row">
                  <span className="progress-label">
                    <span className="progress-dot" style={{ background: status.color }} />
                    {status.label}
                  </span>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: status.color }} />
                  </div>
                  <span className="progress-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
