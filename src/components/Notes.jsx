import { useState } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { usePlanner } from '../context/PlannerContext';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Plus, X, Pin, Search, Trash2, Edit3, StickyNote,
  CheckSquare, Square, ListChecks, AlignLeft
} from 'lucide-react';

// Палитра «Сдержанная глубокая» — приглушённые тона в тон бренду.
// Ключи прежние (default/blue/green/purple/pink/yellow), чтобы у старых заметок цвет не слетел.
const NOTE_COLORS = [
  { key: 'default', color: '#f1efe8', border: '#a8a59a' },
  { key: 'blue', color: '#e8ede2', border: '#5a6b50' },
  { key: 'green', color: '#e2efec', border: '#4f8a82' },
  { key: 'purple', color: '#efe6ee', border: '#8a6b86' },
  { key: 'pink', color: '#f4e7e1', border: '#b06a4f' },
  { key: 'yellow', color: '#f3ecd8', border: '#b9923f' },
];

const now = () => new Date().toISOString();

export default function Notes() {
  const { notes, setNotes } = usePlanner();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', content: '', type: 'text', items: [], color: 'default', pinned: false });
  const [itemInput, setItemInput] = useState('');

  const resetForm = () => {
    setForm({ title: '', content: '', type: 'text', items: [], color: 'default', pinned: false });
    setItemInput('');
    setEditId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const hasBody = form.type === 'text' ? form.content.trim() : form.items.length > 0;
    if (!form.title.trim() && !hasBody) return;
    const note = {
      id: editId || uuidv4(),
      title: form.title,
      type: form.type,
      content: form.type === 'text' ? form.content : '',
      items: form.type === 'checklist' ? form.items : [],
      color: form.color,
      pinned: form.pinned,
      updatedAt: now(),
      createdAt: editId ? notes.find(n => n.id === editId)?.createdAt : now(),
    };
    if (editId) {
      setNotes(notes.map(n => n.id === editId ? note : n));
    } else {
      setNotes([note, ...notes]);
    }
    resetForm();
    setShowAdd(false);
  };

  const handleEdit = (note) => {
    setForm({
      title: note.title || '',
      content: note.content || '',
      type: note.type || 'text',
      items: note.items || [],
      color: note.color || 'default',
      pinned: !!note.pinned,
    });
    setEditId(note.id);
    setShowAdd(true);
  };

  // Переключение вида прямо в форме — с логическим форматированием текста
  const switchType = (target) => {
    if (target === form.type) return;
    if (target === 'checklist') {
      const items = form.items.length
        ? form.items
        : (form.content || '').split('\n').map(l => l.trim()).filter(Boolean)
            .map(l => ({ id: uuidv4(), text: l, done: false }));
      setForm({ ...form, type: 'checklist', items, content: '' });
    } else {
      const content = form.content
        ? form.content
        : (form.items || []).map(i => i.text).join('\n');
      setForm({ ...form, type: 'text', content, items: [] });
    }
  };

  // Пункты в форме
  const addFormItem = () => {
    const t = itemInput.trim();
    if (!t) return;
    setForm({ ...form, items: [...form.items, { id: uuidv4(), text: t, done: false }] });
    setItemInput('');
  };
  const removeFormItem = (id) => setForm({ ...form, items: form.items.filter(i => i.id !== id) });

  const togglePin = (id) => setNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  const handleDelete = (id) => setNotes(notes.filter(n => n.id !== id));

  // Пункты в карточке чек-листа
  const toggleItem = (noteId, itemId) => setNotes(notes.map(n => n.id === noteId
    ? { ...n, items: (n.items || []).map(i => i.id === itemId ? { ...i, done: !i.done } : i), updatedAt: now() }
    : n));
  const addItem = (noteId, text) => {
    if (!text.trim()) return;
    setNotes(notes.map(n => n.id === noteId
      ? { ...n, items: [...(n.items || []), { id: uuidv4(), text: text.trim(), done: false }], updatedAt: now() }
      : n));
  };
  const deleteItem = (noteId, itemId) => setNotes(notes.map(n => n.id === noteId
    ? { ...n, items: (n.items || []).filter(i => i.id !== itemId), updatedAt: now() }
    : n));

  // Конвертация заметка ↔ чек-лист
  const convertNote = (note) => {
    if ((note.type || 'text') === 'text') {
      const items = (note.content || '').split('\n').map(l => l.trim()).filter(Boolean)
        .map(l => ({ id: uuidv4(), text: l, done: false }));
      setNotes(notes.map(n => n.id === note.id ? { ...n, type: 'checklist', items, content: '', updatedAt: now() } : n));
    } else {
      const content = (note.items || []).map(i => i.text).join('\n');
      setNotes(notes.map(n => n.id === note.id ? { ...n, type: 'text', content, items: [], updatedAt: now() } : n));
    }
  };

  const filtered = notes
    .filter(n => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (n.title || '').toLowerCase().includes(s)
        || (n.content || '').toLowerCase().includes(s)
        || (n.items || []).some(i => i.text.toLowerCase().includes(s));
    })
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="notes-page">
      <div className="section-header">
        <div className="search-box">
          <Search size={16} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск заметок..." />
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowAdd(true); }}>
          <Plus size={16} /> Новая заметка
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <StickyNote size={48} />
          <p>{search ? 'Ничего не найдено' : 'Нет заметок. Создайте первую!'}</p>
        </div>
      ) : (
        <div className="notes-grid">
          {filtered.map(note => {
            const colorInfo = NOTE_COLORS.find(c => c.key === note.color) || NOTE_COLORS[0];
            return (
              <NoteCard
                key={note.id}
                note={note}
                colorInfo={colorInfo}
                onPin={togglePin}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleItem={toggleItem}
                onAddItem={addItem}
                onDeleteItem={deleteItem}
                onConvert={convertNote}
              />
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Редактировать' : 'Новая заметка'}</h3>
              <button className="btn-icon" onClick={() => { setShowAdd(false); resetForm(); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Заголовок</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label>Вид</label>
                <div className="type-toggle">
                  <button type="button" className={`type-btn ${form.type === 'text' ? 'active' : ''}`} onClick={() => switchType('text')}>
                    📝 Текст
                  </button>
                  <button type="button" className={`type-btn ${form.type === 'checklist' ? 'active' : ''}`} onClick={() => switchType('checklist')}>
                    ☑️ Чек-лист
                  </button>
                </div>
              </div>
              {form.type === 'text' ? (
                <div className="form-group">
                  <label>Содержание</label>
                  <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={8} />
                </div>
              ) : (
                <div className="form-group">
                  <label>Пункты</label>
                  <div className="add-inline">
                    <input
                      type="text" value={itemInput}
                      onChange={e => setItemInput(e.target.value)}
                      placeholder="Добавить пункт..."
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFormItem(); } }}
                    />
                    <button type="button" className="btn-icon-sm" onClick={addFormItem}><Plus size={14} /></button>
                  </div>
                  {form.items.length > 0 && (
                    <div className="checklist" style={{ marginTop: '8px' }}>
                      {form.items.map(item => (
                        <div key={item.id} className="checklist-item">
                          <span>• {item.text}</span>
                          <button type="button" className="btn-icon-xs" onClick={() => removeFormItem(item.id)}><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="form-group">
                <label>Цвет</label>
                <div className="color-picker">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c.key} type="button"
                      className={`color-swatch ${form.color === c.key ? 'active' : ''}`}
                      style={{ background: c.border }}
                      onClick={() => setForm({ ...form, color: c.key })}
                    />
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowAdd(false); resetForm(); }}>Отмена</button>
                <button type="submit" className="btn-primary"><Plus size={16} /> {editId ? 'Сохранить' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, colorInfo, onPin, onEdit, onDelete, onToggleItem, onAddItem, onDeleteItem, onConvert }) {
  const [newItem, setNewItem] = useState('');
  const isChecklist = (note.type || 'text') === 'checklist';
  const items = note.items || [];
  const doneCount = items.filter(i => i.done).length;
  const progress = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const handleAdd = () => { onAddItem(note.id, newItem); setNewItem(''); };

  return (
    <div
      className={`note-card ${note.pinned ? 'pinned' : ''}`}
      style={{ background: colorInfo.color, borderColor: colorInfo.border }}
    >
      <div className="note-card-header">
        <button className={`pin-btn ${note.pinned ? 'active' : ''}`} onClick={() => onPin(note.id)}>
          <Pin size={14} />
        </button>
        <div className="note-card-actions">
          <button className="btn-icon-xs" onClick={() => onConvert(note)} title={isChecklist ? 'Превратить в текст' : 'Превратить в чек-лист'}>
            {isChecklist ? <AlignLeft size={12} /> : <ListChecks size={12} />}
          </button>
          <button className="btn-icon-xs" onClick={() => onEdit(note)} title="Изменить"><Edit3 size={12} /></button>
          <button className="btn-icon-xs" onClick={() => onDelete(note.id)} title="Удалить"><Trash2 size={12} /></button>
        </div>
      </div>
      {note.title && <h4 className="note-title">{note.title}</h4>}

      {isChecklist ? (
        <div className="note-checklist">
          {items.length > 0 && (
            <div className="note-progress">
              <div className="progress-bar">
                <div className="progress-fill green" style={{ width: `${progress}%` }} />
              </div>
              <span className="note-progress-text">{doneCount} из {items.length}</span>
            </div>
          )}
          <div className="checklist">
            {items.map(item => (
              <div key={item.id} className={`checklist-item ${item.done ? 'done' : ''}`}>
                <button className="check-btn" onClick={() => onToggleItem(note.id, item.id)}>
                  {item.done ? <CheckSquare size={15} /> : <Square size={15} />}
                </button>
                <span>{item.text}</span>
                <button className="btn-icon-xs" onClick={() => onDeleteItem(note.id, item.id)}><X size={11} /></button>
              </div>
            ))}
          </div>
          <div className="add-inline small">
            <input
              type="text" value={newItem}
              onChange={e => setNewItem(e.target.value)}
              placeholder="Добавить пункт..."
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <button className="btn-icon-xs" onClick={handleAdd}><Plus size={12} /></button>
          </div>
        </div>
      ) : (
        note.content && <p className="note-content">{note.content}</p>
      )}

      {note.updatedAt && !Number.isNaN(new Date(note.updatedAt).getTime()) && (
        <span className="note-date">{format(new Date(note.updatedAt), 'd MMM, HH:mm', { locale: ru })}</span>
      )}
    </div>
  );
}
