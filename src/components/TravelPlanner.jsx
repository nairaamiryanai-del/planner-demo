import { useState } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { usePlanner } from '../context/PlannerContext';
import { PACKING_CATEGORIES } from '../data/defaultData';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { parseDay, daysUntil } from '../lib/dates';
import { v4 as uuidv4 } from 'uuid';
import {
  Plus, X, Check, Trash2, Edit3, Plane, MapPin,
  Calendar, ChevronDown, ChevronUp, CheckSquare, Square, FileText
} from 'lucide-react';

export default function TravelPlanner() {
  const { trips, setTrips } = usePlanner();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [form, setForm] = useState({
    destination: '', dateFrom: '', dateTo: '', notes: '', budget: ''
  });
  // Список «что взять с собой» по группам, заполняемый прямо при создании поездки
  const [packItems, setPackItems] = useState([]); // [{ text, category }]
  const [packInput, setPackInput] = useState('');
  const [packCat, setPackCat] = useState('clothes');

  const addPackItem = () => {
    const text = packInput.trim();
    if (!text) return;
    setPackItems([...packItems, { text, category: packCat }]);
    setPackInput('');
  };

  const removePackItem = (index) => {
    setPackItems(packItems.filter((_, i) => i !== index));
  };

  const resetAddForm = () => {
    setForm({ destination: '', dateFrom: '', dateTo: '', notes: '', budget: '' });
    setPackItems([]);
    setPackInput('');
    setPackCat('clothes');
    setEditId(null);
    setShowAdd(false);
  };

  const handleEditTrip = (trip) => {
    setForm({
      destination: trip.destination || '',
      dateFrom: trip.dateFrom || '',
      dateTo: trip.dateTo || '',
      notes: trip.notes || '',
      budget: trip.budget ? String(trip.budget) : '',
    });
    setEditId(trip.id);
    setShowAdd(true);
  };

  const handleAddTrip = (e) => {
    e.preventDefault();
    if (!form.destination.trim()) return;
    if (editId) {
      // Редактируем основные поля, сохраняя вещи/дела/расходы
      setTrips(trips.map(t => t.id === editId ? {
        ...t,
        destination: form.destination,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        notes: form.notes,
        budget: Number(form.budget) || 0,
      } : t));
      resetAddForm();
      return;
    }
    const trip = {
      id: uuidv4(),
      ...form,
      budget: Number(form.budget) || 0,
      status: 'planning',
      todos: [],
      // Вещи из формы раскладываем по их группам
      packing: Object.keys(PACKING_CATEGORIES).map(cat => ({
        category: cat,
        items: packItems
          .filter(p => p.category === cat)
          .map(p => ({ id: uuidv4(), text: p.text, packed: false })),
      })),
      expenses: [],
      createdAt: new Date().toISOString(),
    };
    setTrips([...trips, trip]);
    resetAddForm();
    setExpandedTrip(trip.id);
  };

  const handleDeleteTrip = (id) => {
    setTrips(trips.filter(t => t.id !== id));
    if (expandedTrip === id) setExpandedTrip(null);
  };

  const addTodo = (tripId, text) => {
    if (!text.trim()) return;
    setTrips(trips.map(t => t.id === tripId ? {
      ...t, todos: [...(t.todos || []), { id: uuidv4(), text, done: false }]
    } : t));
  };

  const toggleTodo = (tripId, todoId) => {
    setTrips(trips.map(t => t.id === tripId ? {
      ...t, todos: (t.todos || []).map(td => td.id === todoId ? { ...td, done: !td.done } : td)
    } : t));
  };

  const deleteTodo = (tripId, todoId) => {
    setTrips(trips.map(t => t.id === tripId ? {
      ...t, todos: (t.todos || []).filter(td => td.id !== todoId)
    } : t));
  };

  const addPackingItem = (tripId, category, text) => {
    if (!text.trim()) return;
    setTrips(trips.map(t => t.id === tripId ? {
      ...t, packing: (t.packing || []).map(p => p.category === category ? {
        ...p, items: [...(p.items || []), { id: uuidv4(), text, packed: false }]
      } : p)
    } : t));
  };

  const togglePackingItem = (tripId, category, itemId) => {
    setTrips(trips.map(t => t.id === tripId ? {
      ...t, packing: (t.packing || []).map(p => p.category === category ? {
        ...p, items: (p.items || []).map(i => i.id === itemId ? { ...i, packed: !i.packed } : i)
      } : p)
    } : t));
  };

  const updateTripNotes = (tripId, notes) => {
    setTrips(trips.map(t => t.id === tripId ? { ...t, notes } : t));
  };

  // Статус по календарным дням: день возвращения — ещё «В поездке», не «Завершена»
  const getStatusInfo = (trip) => {
    if (!trip.dateFrom) return { label: 'Планируется', emoji: '⏳', color: '#94a3b8' };
    const days = daysUntil(trip.dateFrom);
    const daysToEnd = daysUntil(trip.dateTo || trip.dateFrom);
    if (days <= 0 && daysToEnd >= 0) return { label: 'В поездке', emoji: '🛫', color: '#f59e0b' };
    if (daysToEnd < 0) return { label: 'Завершена', emoji: '✅', color: '#10b981' };
    return {
      label: days === 1 ? 'Завтра!' : `Через ${days} дн.`,
      emoji: '⏳', color: '#6366f1',
    };
  };

  return (
    <div className="travel-page">
      <div className="section-header">
        <h2>Мои поездки</h2>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Новая поездка
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="empty-state">
          <Plane size={48} />
          <p>Нет запланированных поездок</p>
        </div>
      ) : (
        <div className="trips-list">
          {trips.map(trip => {
            const status = getStatusInfo(trip);
            const isExpanded = expandedTrip === trip.id;
            const tripTodos = trip.todos || [];
            const tripPacking = trip.packing || [];
            const todosDone = tripTodos.filter(t => t.done).length;
            const totalPackingItems = tripPacking.reduce((s, p) => s + (p.items || []).length, 0);
            const packedItems = tripPacking.reduce((s, p) => s + (p.items || []).filter(i => i.packed).length, 0);

            return (
              <div key={trip.id} className="trip-card">
                <div className="trip-header" onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}>
                  <div className="trip-info">
                    <span className="trip-status" style={{ background: status.color }}>{status.emoji} {status.label}</span>
                    <h3><MapPin size={16} /> {trip.destination}</h3>
                    {trip.dateFrom && (
                      <span className="trip-dates">
                        <Calendar size={14} />
                        {format(parseDay(trip.dateFrom), 'd MMM', { locale: ru })}
                        {trip.dateTo && ` — ${format(parseDay(trip.dateTo), 'd MMM yyyy', { locale: ru })}`}
                      </span>
                    )}
                  </div>
                  <div className="trip-summary">
                    {tripTodos.length > 0 && <span className="trip-badge">📝 {todosDone}/{tripTodos.length}</span>}
                    {totalPackingItems > 0 && <span className="trip-badge">🧳 {packedItems}/{totalPackingItems}</span>}
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="trip-details">
                    {/* Дела до поездки */}
                    <TripSection title="📝 Дела до поездки" tripId={trip.id} items={tripTodos}
                      onAdd={addTodo} onToggle={toggleTodo} onDelete={deleteTodo}
                      progress={tripTodos.length > 0 ? Math.round((todosDone / tripTodos.length) * 100) : 0}
                    />

                    {/* Список вещей */}
                    <div className="trip-section">
                      <h4>🧳 Список вещей</h4>
                      {totalPackingItems > 0 && (
                        <div className="progress-bar-container">
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${Math.round((packedItems / totalPackingItems) * 100)}%` }} />
                          </div>
                          <span className="progress-text">{packedItems}/{totalPackingItems} собрано</span>
                        </div>
                      )}
                      <div className="packing-categories">
                        {tripPacking.map(pack => {
                          const cat = PACKING_CATEGORIES[pack.category];
                          return (
                            <PackingCategory
                              key={pack.category}
                              category={cat}
                              items={pack.items || []}
                              onAdd={(text) => addPackingItem(trip.id, pack.category, text)}
                              onToggle={(itemId) => togglePackingItem(trip.id, pack.category, itemId)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Заметки */}
                    <div className="trip-section">
                      <h4><FileText size={16} /> Заметки</h4>
                      <textarea
                        className="trip-notes"
                        value={trip.notes || ''}
                        onChange={(e) => updateTripNotes(trip.id, e.target.value)}
                        placeholder="Заметки по поездке..."
                        rows={3}
                      />
                    </div>

                    <div className="trip-bottom-actions">
                      <button className="btn-secondary" onClick={() => handleEditTrip(trip)}>
                        <Edit3 size={14} /> Изменить
                      </button>
                      <button className="btn-danger" onClick={() => handleDeleteTrip(trip.id)}>
                        <Trash2 size={14} /> Удалить поездку
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? 'Редактировать поездку' : 'Новая поездка'}</h3>
              <button className="btn-icon" onClick={resetAddForm}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddTrip} className="modal-body">
              <div className="form-group">
                <label>Куда</label>
                <input type="text" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} placeholder="Город или страна" autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Дата отъезда</label>
                  <input type="date" value={form.dateFrom} onChange={e => setForm({...form, dateFrom: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Дата возвращения</label>
                  <input type="date" value={form.dateTo} onChange={e => setForm({...form, dateTo: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Бюджет (₽)</label>
                <input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Заметка по поездке..." />
              </div>
              {!editId && (
                <div className="form-group">
                  <label>Что взять с собой</label>
                  <div className="pack-add">
                    <input
                      type="text"
                      className="pack-add-text"
                      value={packInput}
                      onChange={e => setPackInput(e.target.value)}
                      placeholder="Например: загранпаспорт"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPackItem(); } }}
                    />
                    <select className="pack-add-cat" value={packCat} onChange={e => setPackCat(e.target.value)}>
                      {Object.entries(PACKING_CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>{v.emoji} {v.label}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-icon-sm" onClick={addPackItem}><Plus size={14} /></button>
                  </div>
                  {packItems.length > 0 && (
                    <div className="pack-preview">
                      {Object.entries(PACKING_CATEGORIES).map(([k, v]) => {
                        const items = packItems
                          .map((p, i) => ({ ...p, i }))
                          .filter(p => p.category === k);
                        if (items.length === 0) return null;
                        return (
                          <div key={k} className="pack-group">
                            <div className="pack-group-title">{v.emoji} {v.label}</div>
                            <div className="checklist">
                              {items.map(p => (
                                <div key={p.i} className="checklist-item">
                                  <span>{p.text}</span>
                                  <button type="button" className="btn-icon-xs" onClick={() => removePackItem(p.i)}><X size={12} /></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={resetAddForm}>Отмена</button>
                <button type="submit" className="btn-primary"><Check size={16} /> {editId ? 'Сохранить' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TripSection({ title, tripId, items, onAdd, onToggle, onDelete, progress }) {
  const [newItem, setNewItem] = useState('');

  return (
    <div className="trip-section">
      <h4>{title}</h4>
      {items.length > 0 && (
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">{progress}%</span>
        </div>
      )}
      <div className="checklist">
        {items.map(item => (
          <div key={item.id} className={`checklist-item ${item.done ? 'done' : ''}`}>
            <button className="check-btn" onClick={() => onToggle(tripId, item.id)}>
              {item.done ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <span>{item.text}</span>
            <button className="btn-icon-xs" onClick={() => onDelete(tripId, item.id)}><X size={12} /></button>
          </div>
        ))}
      </div>
      <div className="add-inline">
        <input
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder="Добавить..."
          onKeyDown={e => { if (e.key === 'Enter') { onAdd(tripId, newItem); setNewItem(''); } }}
        />
        <button className="btn-icon-sm" onClick={() => { onAdd(tripId, newItem); setNewItem(''); }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function PackingCategory({ category, items, onAdd, onToggle }) {
  const [newItem, setNewItem] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="packing-cat">
      <div className="packing-cat-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{category.emoji} {category.label}</span>
        <span className="packing-count">{items.filter(i => i.packed).length}/{items.length}</span>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>
      {!collapsed && (
        <>
          <div className="checklist">
            {items.map(item => (
              <div key={item.id} className={`checklist-item ${item.packed ? 'done' : ''}`}>
                <button className="check-btn" onClick={() => onToggle(item.id)}>
                  {item.packed ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <div className="add-inline small">
            <input
              type="text"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              placeholder="Добавить вещь..."
              onKeyDown={e => { if (e.key === 'Enter') { onAdd(newItem); setNewItem(''); } }}
            />
            <button className="btn-icon-xs" onClick={() => { onAdd(newItem); setNewItem(''); }}>
              <Plus size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
