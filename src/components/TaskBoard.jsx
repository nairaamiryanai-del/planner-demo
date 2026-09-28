import { useState } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { TASK_STATUSES, PRIORITIES, CATEGORIES } from '../data/defaultData';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { parseDay, daysUntil } from '../lib/dates';
import { GripVertical, Clock, Tag, Trash2, Edit3 } from 'lucide-react';
import TaskModal from './TaskModal';

function TaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const priority = PRIORITIES[task.priority];
  const category = CATEGORIES[task.category];
  // «Просрочено» — только со следующего календарного дня после дедлайна
  const isOverdue = task.deadline && daysUntil(task.deadline) < 0 && task.status !== 'done';

  return (
    <div
      className={`task-card ${isOverdue ? 'overdue' : ''}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
    >
      <div className="task-card-header">
        <GripVertical size={14} className="drag-handle" />
        <span className="task-priority" style={{ background: priority?.color }}>
          {priority?.emoji}
        </span>
        {category && (
          <span className="task-category-badge" style={{ background: category.color + '20', color: category.color }}>
            {category.emoji} {category.label}
          </span>
        )}
        <div className="task-card-actions">
          <button onClick={() => onEdit(task)} className="btn-icon-sm" title="Изменить">
            <Edit3 size={14} />
          </button>
          <button onClick={() => onDelete(task.id)} className="btn-icon-sm" title="Удалить">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <h4 className="task-title">{task.title}</h4>
      {task.description && <p className="task-desc">{task.description}</p>}
      <div className="task-meta">
        {task.deadline && (
          <span className={`task-deadline ${isOverdue ? 'text-danger' : ''}`}>
            <Clock size={12} />
            {format(parseDay(task.deadline), 'd MMM', { locale: ru })}
          </span>
        )}
        {task.tags?.map(tag => (
          <span key={tag} className="task-tag">
            <Tag size={10} /> {tag}
          </span>
        ))}
      </div>
      <div className="task-status-row">
        <span className="task-status-label">Статус:</span>
        <select
          className="task-status-select"
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {Object.entries(TASK_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function TaskBoard() {
  const { tasks, setTasks, scheduleTask, removeSchedule } = usePlanner();
  const [showAdd, setShowAdd] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [filter, setFilter] = useState('all');

  const handleSave = (task) => {
    setTasks(tasks.some(t => t.id === task.id)
      ? tasks.map(t => t.id === task.id ? task : t)
      : [...tasks, task]);
    scheduleTask(task);
  };

  const handleDelete = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
    removeSchedule(id);
  };

  const changeStatus = (taskId, newStatus) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    const moved = tasks.find(t => t.id === taskId);
    if (moved) scheduleTask({ ...moved, status: newStatus });
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    changeStatus(taskId, newStatus);
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.category === filter);

  return (
    <div className="task-board-page">
      <div className="board-toolbar">
        <div className="filter-pills">
          <button className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Все</button>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button key={key} className={`pill ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Новая задача</button>
      </div>

      <div className="kanban-board">
        {Object.entries(TASK_STATUSES).map(([statusKey, statusInfo]) => (
          <div
            key={statusKey}
            className="kanban-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, statusKey)}
          >
            <div className="column-header">
              <span className="column-dot" style={{ background: statusInfo.color }} />
              <h3>{statusInfo.label}</h3>
              <span className="column-count">
                {filteredTasks.filter(t => t.status === statusKey).length}
              </span>
            </div>
            <div className="column-body">
              {filteredTasks
                .filter(t => t.status === statusKey)
                .map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={setEditTask}
                    onDelete={handleDelete}
                    onStatusChange={changeStatus}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {(showAdd || editTask) && (
        <TaskModal
          task={editTask}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditTask(null); }}
        />
      )}
    </div>
  );
}
