import { useState } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { usePlanner } from '../context/PlannerContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { parseDay, todayStr } from '../lib/dates';
import { v4 as uuidv4 } from 'uuid';
import {
  Plus, X, Check, Trash2, Edit3, Minus, CreditCard,
  Archive, ChevronDown, ChevronUp, Briefcase, DollarSign, Clock
} from 'lucide-react';

export default function FreelanceTracker() {
  const { freelanceProjects, setFreelanceProjects, scheduleProject, removeSchedule } = usePlanner();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [form, setForm] = useState({
    name: '', client: '', totalUnits: '', unitName: 'постов', price: '', startDate: '', deadline: '', notes: ''
  });

  const resetForm = () => {
    setForm({ name: '', client: '', totalUnits: '', unitName: 'постов', price: '', startDate: '', deadline: '', notes: '' });
    setEditId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const existing = editId ? freelanceProjects.find(p => p.id === editId) : null;
    const totalUnits = Number(form.totalUnits) || 1;
    const project = {
      id: editId || uuidv4(),
      name: form.name,
      client: form.client,
      totalUnits,
      unitName: form.unitName || 'шт.',
      // Прогресс не может превышать новое число единиц, даты сделанных единиц сохраняем
      doneUnits: Math.min(existing?.doneUnits || 0, totalUnits),
      unitDates: (existing?.unitDates || []).slice(0, totalUnits),
      price: Number(form.price) || 0,
      startDate: form.startDate || null,
      deadline: form.deadline || null,
      notes: form.notes,
      paid: existing?.paid || false,
      archived: existing?.archived || false,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    if (editId) {
      setFreelanceProjects(freelanceProjects.map(p => p.id === editId ? { ...project } : p));
    } else {
      setFreelanceProjects([...freelanceProjects, project]);
    }
    scheduleProject(project);
    resetForm();
    setShowAdd(false);
  };

  const handleEdit = (project) => {
    setForm({
      name: project.name,
      client: project.client || '',
      totalUnits: project.totalUnits.toString(),
      unitName: project.unitName || 'постов',
      price: project.price ? project.price.toString() : '',
      startDate: project.startDate ? format(parseDay(project.startDate), 'yyyy-MM-dd') : '',
      deadline: project.deadline ? format(parseDay(project.deadline), 'yyyy-MM-dd') : '',
      notes: project.notes || '',
    });
    setEditId(project.id);
    setShowAdd(true);
  };

  // Пересобирает даты по числу сделанных единиц: у сделанных — прежняя дата или сегодня,
  // у остальных — null. «Сегодня» считаем в момент клика, а не при рендере.
  const applyDone = (p, newDone) => {
    const today = todayStr();
    return {
      ...p,
      doneUnits: newDone,
      unitDates: Array.from({ length: p.totalUnits }, (_, i) => (
        i < newDone ? (p.unitDates?.[i] ?? today) : null
      )),
    };
  };

  const incrementDone = (id) => {
    setFreelanceProjects(freelanceProjects.map(p =>
      p.id === id ? applyDone(p, Math.min(p.doneUnits + 1, p.totalUnits)) : p
    ));
  };

  const decrementDone = (id) => {
    setFreelanceProjects(freelanceProjects.map(p =>
      p.id === id ? applyDone(p, Math.max(p.doneUnits - 1, 0)) : p
    ));
  };

  const toggleUnitDone = (id, unitIndex) => {
    setFreelanceProjects(freelanceProjects.map(p => {
      if (p.id !== id) return p;
      const newDone = unitIndex < p.doneUnits ? unitIndex : unitIndex + 1;
      return applyDone(p, newDone);
    }));
  };

  // Изменить дату конкретной сделанной единицы
  const setUnitDate = (id, unitIndex, date) => {
    const today = todayStr();
    setFreelanceProjects(freelanceProjects.map(p => {
      if (p.id !== id) return p;
      const arr = Array.from({ length: p.totalUnits }, (_, i) => (
        i < p.doneUnits ? (p.unitDates?.[i] ?? today) : null
      ));
      arr[unitIndex] = date;
      return { ...p, unitDates: arr };
    }));
  };

  const markPaid = (id) => {
    setFreelanceProjects(freelanceProjects.map(p =>
      p.id === id ? { ...p, paid: !p.paid } : p
    ));
    const p = freelanceProjects.find(x => x.id === id);
    if (p) scheduleProject({ ...p, paid: !p.paid });
  };

  const archiveProject = (id) => {
    setFreelanceProjects(freelanceProjects.map(p =>
      p.id === id ? { ...p, archived: true } : p
    ));
    removeSchedule(id);
  };

  const unarchiveProject = (id) => {
    setFreelanceProjects(freelanceProjects.map(p =>
      p.id === id ? { ...p, archived: false } : p
    ));
    const p = freelanceProjects.find(x => x.id === id);
    if (p) scheduleProject({ ...p, archived: false });
  };

  const deleteProject = (id) => {
    setFreelanceProjects(freelanceProjects.filter(p => p.id !== id));
    removeSchedule(id);
  };

  const active = freelanceProjects.filter(p => !p.archived);
  const archived = freelanceProjects.filter(p => p.archived);

  // Stats
  const totalEarned = freelanceProjects.filter(p => p.paid).reduce((s, p) => s + p.price, 0);
  const pendingPayment = active.filter(p => p.doneUnits >= p.totalUnits && !p.paid);
  const inProgress = active.filter(p => p.doneUnits < p.totalUnits);

  return (
    <div className="freelance-page">
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <Briefcase size={20} />
          <div>
            <span className="stat-value">{inProgress.length}</span>
            <span className="stat-label">В работе</span>
          </div>
        </div>
        <div className="stat-card">
          <Clock size={20} />
          <div>
            <span className="stat-value">{pendingPayment.length}</span>
            <span className="stat-label">Ждут оплаты</span>
          </div>
        </div>
        <div className="stat-card earned">
          <DollarSign size={20} />
          <div>
            <span className="stat-value">{totalEarned.toLocaleString('ru-RU')} ₽</span>
            <span className="stat-label">Заработано</span>
          </div>
        </div>
      </div>

      <div className="section-header">
        <h2>Мои заказы</h2>
        <button className="btn-primary" onClick={() => { resetForm(); setShowAdd(true); }}>
          <Plus size={16} /> Новый заказ
        </button>
      </div>

      {/* Active projects */}
      {active.length === 0 ? (
        <div className="empty-state">
          <Briefcase size={48} />
          <p>Нет активных заказов. Добавьте первый!</p>
        </div>
      ) : (
        <div className="freelance-list">
          {active.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onIncrement={incrementDone}
              onDecrement={decrementDone}
              onToggleUnit={toggleUnitDone}
              onSetUnitDate={setUnitDate}
              onMarkPaid={markPaid}
              onArchive={archiveProject}
              onEdit={handleEdit}
              onDelete={deleteProject}
            />
          ))}
        </div>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div className="archive-section" style={{ marginTop: '32px' }}>
          <button className="btn-text" onClick={() => setShowArchive(!showArchive)}>
            <Archive size={16} /> Архив ({archived.length})
            {showArchive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showArchive && (
            <div className="freelance-list archived-list">
              {archived.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onIncrement={incrementDone}
                  onDecrement={decrementDone}
                  onToggleUnit={toggleUnitDone}
                  onSetUnitDate={setUnitDate}
                  onMarkPaid={markPaid}
                  onUnarchive={unarchiveProject}
                  onDelete={deleteProject}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Редактировать заказ' : 'Новый заказ'}</h3>
              <button className="btn-icon" onClick={() => { setShowAdd(false); resetForm(); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Название</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Telegram посты, Дизайн лендинга..." autoFocus />
              </div>
              <div className="form-group">
                <label>Клиент</label>
                <input type="text" value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="ИИ команда, ООО «Рога»..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Количество единиц</label>
                  <input type="number" value={form.totalUnits} onChange={e => setForm({...form, totalUnits: e.target.value})} placeholder="8" min="1" />
                </div>
                <div className="form-group">
                  <label>Единица</label>
                  <select value={form.unitName} onChange={e => setForm({...form, unitName: e.target.value})}>
                    <option value="постов">постов</option>
                    <option value="макетов">макетов</option>
                    <option value="страниц">страниц</option>
                    <option value="экранов">экранов</option>
                    <option value="баннеров">баннеров</option>
                    <option value="видео">видео</option>
                    <option value="статей">статей</option>
                    <option value="часов">часов</option>
                    <option value="шт.">шт.</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Цена (₽)</label>
                <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="15000" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Дата начала</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Дедлайн</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Заметки</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Детали заказа..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowAdd(false); resetForm(); }}>Отмена</button>
                <button type="submit" className="btn-primary"><Check size={16} /> {editId ? 'Сохранить' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onIncrement, onDecrement, onToggleUnit, onSetUnitDate, onMarkPaid, onArchive, onUnarchive, onEdit, onDelete, isArchived }) {
  const { doneUnits, totalUnits, unitName, paid } = project;
  const progress = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;
  const isComplete = doneUnits >= totalUnits;

  const getStatusText = () => {
    if (paid) return '💰 Оплачено';
    if (isComplete) return '✓ Готово к сдаче!';
    return `${doneUnits} из ${totalUnits} ${unitName}`;
  };

  const getStatusColor = () => {
    if (paid) return '#10b981';
    if (isComplete) return '#f59e0b';
    return '#5a6b50';
  };

  return (
    <div className={`fl-card ${isComplete ? 'complete' : ''} ${paid ? 'paid' : ''} ${isArchived ? 'archived-card' : ''}`}
         style={{ borderLeftColor: getStatusColor() }}>
      <div className="fl-card-top">
        <div className="fl-card-info">
          <h3 className="fl-card-title">
            {project.name}
            {project.client && <span className="fl-client">({project.client})</span>}
          </h3>
          <span className={`fl-status ${isComplete ? 'done' : ''} ${paid ? 'paid-text' : ''}`}>
            {getStatusText()}
          </span>
        </div>

        <div className="fl-card-buttons">
          {isComplete && !paid && (
            <button className="fl-btn-pay" onClick={() => onMarkPaid(project.id)}>
              <CreditCard size={14} /> Оплатить
            </button>
          )}
          {paid && (
            <button className="fl-btn-pay paid-btn" onClick={() => onMarkPaid(project.id)}>
              💰 Оплачено
            </button>
          )}
          {!isArchived && onArchive && (
            <button className="fl-btn-archive" onClick={() => onArchive(project.id)}>
              <Archive size={14} /> В архив
            </button>
          )}
          {isArchived && onUnarchive && (
            <button className="fl-btn-archive" onClick={() => onUnarchive(project.id)}>
              ↩️ Вернуть
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="fl-progress">
        <div className="fl-progress-bar">
          <div
            className={`fl-progress-fill ${isComplete ? (paid ? 'green' : 'gold') : ''}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Unit buttons */}
      <div className="fl-units-row">
        <div className="fl-unit-buttons">
          {Array.from({ length: totalUnits }, (_, i) => {
            const done = i < doneUnits;
            const d = project.unitDates?.[i] ?? '';
            return (
              <div key={i} className="fl-unit-cell">
                <button
                  className={`fl-unit-btn ${done ? 'done' : ''}`}
                  onClick={() => onToggleUnit(project.id, i)}
                  disabled={isArchived}
                >
                  {i + 1}
                </button>
                {done && !isArchived && (
                  <input
                    type="date"
                    className="fl-unit-date"
                    value={d}
                    title="Когда сделан этот пост"
                    onChange={(e) => onSetUnitDate(project.id, i, e.target.value)}
                  />
                )}
                {done && isArchived && d && (
                  <span className="fl-unit-date-label">{format(parseDay(d), 'd MMM', { locale: ru })}</span>
                )}
              </div>
            );
          })}
        </div>
        {!isArchived && (
          <div className="fl-counter-btns">
            <button className="fl-counter-btn" onClick={() => onDecrement(project.id)} disabled={doneUnits <= 0}>
              <Minus size={16} />
            </button>
            <button className="fl-counter-btn plus" onClick={() => onIncrement(project.id)} disabled={doneUnits >= totalUnits}>
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="fl-meta">
        {project.price > 0 && (
          <span className="fl-price">{project.price.toLocaleString('ru-RU')} ₽</span>
        )}
        {(project.startDate || project.deadline) && (
          <span className="fl-deadline">
            <Clock size={12} />
            {project.startDate && ' ' + format(parseDay(project.startDate), 'd MMM', { locale: ru })}
            {project.startDate && project.deadline && ' →'}
            {project.deadline && ' ' + format(parseDay(project.deadline), 'd MMM', { locale: ru })}
          </span>
        )}
        {project.notes && <span className="fl-notes-hint" title={project.notes}>📝</span>}
        <div className="fl-meta-actions">
          {onEdit && !isArchived && (
            <button className="btn-icon-xs" onClick={() => onEdit(project)}><Edit3 size={13} /></button>
          )}
          <button className="btn-icon-xs" onClick={() => onDelete(project.id)}><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}
