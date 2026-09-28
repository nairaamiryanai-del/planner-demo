import { useState } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { PRIORITIES, CATEGORIES } from '../data/defaultData';
import { format } from 'date-fns';
import { parseDay } from '../lib/dates';
import { v4 as uuidv4 } from 'uuid';
import { X, Check } from 'lucide-react';

export default function TaskModal({ task, defaultDeadline, onSave, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'medium',
    category: task?.category || 'personal',
    deadline: task?.deadline
      ? format(parseDay(task.deadline), 'yyyy-MM-dd')
      : (defaultDeadline || ''),
    tags: task?.tags?.join(', ') || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      id: task?.id || uuidv4(),
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      status: task?.status || 'todo',
      // Дедлайн храним как 'yyyy-MM-dd' (перевод через toISOString сдвигал день
      // в западных часовых поясах); старые ISO-значения нормализует parseDay при чтении
      deadline: form.deadline || null,
      createdAt: task?.createdAt || new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={shakeOnOverlayClick}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{task ? 'Редактировать задачу' : 'Новая задача'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Название</label>
            <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Что нужно сделать?" autoFocus />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Подробности..." rows={3} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Приоритет</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Категория</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Дедлайн</label>
              <input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Теги (через запятую)</label>
              <input type="text" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="важно, работа" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-primary">
              <Check size={16} /> {task ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
