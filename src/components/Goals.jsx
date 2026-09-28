import { useState } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { usePlanner } from '../context/PlannerContext';
import { v4 as uuidv4 } from 'uuid';
import { daysUntil } from '../lib/dates';
import { Plus, X, Check, Trash2, Edit3, Target, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';

const GOAL_CATEGORIES = {
  personal: { label: 'Личные', emoji: '🏠', color: '#ec4899' },
  career: { label: 'Карьера', emoji: '💼', color: '#6366f1' },
  finance: { label: 'Финансы', emoji: '💰', color: '#f59e0b' },
  health: { label: 'Здоровье', emoji: '🏥', color: '#10b981' },
  education: { label: 'Образование', emoji: '📚', color: '#3b82f6' },
};

export default function Goals() {
  const { goals, setGoals } = usePlanner();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedGoal, setExpandedGoal] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'personal', deadline: '' });

  const closeModal = () => {
    setForm({ title: '', description: '', category: 'personal', deadline: '' });
    setEditId(null);
    setShowAdd(false);
  };

  const handleEdit = (goal) => {
    setForm({
      title: goal.title,
      description: goal.description || '',
      category: goal.category || 'personal',
      deadline: goal.deadline || '',
    });
    setEditId(goal.id);
    setShowAdd(true);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (editId) {
      setGoals(goals.map(g => g.id === editId
        ? { ...g, title: form.title, description: form.description, category: form.category, deadline: form.deadline }
        : g));
    } else {
      const goal = {
        id: uuidv4(),
        ...form,
        steps: [],
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setGoals([...goals, goal]);
    }
    closeModal();
  };

  const handleDelete = (id) => {
    setGoals(goals.filter(g => g.id !== id));
  };

  const toggleCompleted = (id) => {
    setGoals(goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const addStep = (goalId, text) => {
    if (!text.trim()) return;
    setGoals(goals.map(g => g.id === goalId ? {
      ...g, steps: [...(g.steps || []), { id: uuidv4(), text, done: false }]
    } : g));
  };

  const toggleStep = (goalId, stepId) => {
    setGoals(goals.map(g => g.id === goalId ? {
      ...g, steps: (g.steps || []).map(s => s.id === stepId ? { ...s, done: !s.done } : s)
    } : g));
  };

  const deleteStep = (goalId, stepId) => {
    setGoals(goals.map(g => g.id === goalId ? {
      ...g, steps: (g.steps || []).filter(s => s.id !== stepId)
    } : g));
  };

  const activeGoals = goals.filter(g => !g.completed);
  const completedGoals = goals.filter(g => g.completed);

  return (
    <div className="goals-page">
      <div className="section-header">
        <h2>Мои цели</h2>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Новая цель
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="empty-state">
          <Target size={48} />
          <p>Поставьте первую цель!</p>
        </div>
      ) : (
        <>
          <div className="goals-list">
            {activeGoals.map(goal => {
              const cat = GOAL_CATEGORIES[goal.category];
              const isExpanded = expandedGoal === goal.id;
              const stepsTotal = (goal.steps || []).length;
              const stepsDone = (goal.steps || []).filter(s => s.done).length;
              const progress = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0;
              const daysLeft = goal.deadline ? daysUntil(goal.deadline) : null;

              return (
                <GoalCard
                  key={goal.id} goal={goal} cat={cat} isExpanded={isExpanded}
                  progress={progress} stepsTotal={stepsTotal} stepsDone={stepsDone} daysLeft={daysLeft}
                  onToggleExpand={() => setExpandedGoal(isExpanded ? null : goal.id)}
                  onDelete={handleDelete} onToggleCompleted={toggleCompleted} onEdit={handleEdit}
                  onAddStep={addStep} onToggleStep={toggleStep} onDeleteStep={deleteStep}
                />
              );
            })}
          </div>

          {completedGoals.length > 0 && (
            <div className="completed-goals">
              <h3>✅ Достигнутые цели ({completedGoals.length})</h3>
              <div className="goals-list completed">
                {completedGoals.map(goal => {
                  const cat = GOAL_CATEGORIES[goal.category];
                  return (
                    <div key={goal.id} className="goal-card completed">
                      <div className="goal-header">
                        <span className="goal-cat" style={{ color: cat?.color }}>{cat?.emoji} {cat?.label}</span>
                        <h4>{goal.title}</h4>
                        <div className="goal-actions">
                          <button className="btn-icon-sm" onClick={() => handleEdit(goal)} title="Изменить"><Edit3 size={14} /></button>
                          <button className="btn-icon-sm" onClick={() => toggleCompleted(goal.id)} title="Вернуть">↩️</button>
                          <button className="btn-icon-sm" onClick={() => handleDelete(goal.id)}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Редактировать цель' : 'Новая цель'}</h3>
              <button className="btn-icon" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="modal-body">
              <div className="form-group">
                <label>Цель</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Чего хочу достичь?" autoFocus />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Категория</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {Object.entries(GOAL_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Дедлайн</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Отмена</button>
                <button type="submit" className="btn-primary"><Check size={16} /> {editId ? 'Сохранить' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, cat, isExpanded, progress, stepsTotal, stepsDone, daysLeft, onToggleExpand, onDelete, onToggleCompleted, onEdit, onAddStep, onToggleStep, onDeleteStep }) {
  const [newStep, setNewStep] = useState('');

  return (
    <div className="goal-card" style={{ borderLeftColor: cat?.color }}>
      <div className="goal-header" onClick={onToggleExpand}>
        <div className="goal-info">
          <span className="goal-cat" style={{ color: cat?.color }}>{cat?.emoji} {cat?.label}</span>
          <h4>{goal.title}</h4>
          {goal.description && <p className="goal-desc">{goal.description}</p>}
        </div>
        <div className="goal-right">
          {daysLeft !== null && (
            <span className={`goal-deadline ${daysLeft < 0 ? 'overdue' : daysLeft < 7 ? 'soon' : ''}`}>
              {daysLeft < 0 ? `Просрочено на ${Math.abs(daysLeft)} дн.`
                : daysLeft === 0 ? 'Сегодня последний день'
                : `${daysLeft} дн. осталось`}
            </span>
          )}
          <div className="goal-progress-mini">
            <div className="progress-bar small">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {isExpanded && (
        <div className="goal-body">
          <div className="goal-steps-header">
            <span>Шаги ({stepsDone}/{stepsTotal})</span>
            <button className="btn-icon-sm check-all" onClick={() => onToggleCompleted(goal.id)} title="Отметить цель как достигнутую">
              <Check size={14} /> Достигнуто
            </button>
          </div>
          <div className="checklist">
            {(goal.steps || []).map(step => (
              <div key={step.id} className={`checklist-item ${step.done ? 'done' : ''}`}>
                <button className="check-btn" onClick={() => onToggleStep(goal.id, step.id)}>
                  {step.done ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <span>{step.text}</span>
                <button className="btn-icon-xs" onClick={() => onDeleteStep(goal.id, step.id)}><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="add-inline">
            <input
              type="text" value={newStep} onChange={e => setNewStep(e.target.value)}
              placeholder="Новый шаг..."
              onKeyDown={e => { if (e.key === 'Enter') { onAddStep(goal.id, newStep); setNewStep(''); } }}
            />
            <button className="btn-icon-sm" onClick={() => { onAddStep(goal.id, newStep); setNewStep(''); }}>
              <Plus size={14} />
            </button>
          </div>
          <div className="goal-actions-bottom">
            <button className="btn-secondary-sm" onClick={() => onEdit(goal)}><Edit3 size={12} /> Изменить</button>
            <button className="btn-danger-sm" onClick={() => onDelete(goal.id)}><Trash2 size={12} /> Удалить</button>
          </div>
        </div>
      )}
    </div>
  );
}
