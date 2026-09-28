import { useState } from 'react';
import { shakeOnOverlayClick } from '../lib/modal';
import { usePlanner } from '../context/PlannerContext';
import { SHOPPING_CATEGORIES } from '../data/defaultData';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Plus, X, Check, Trash2, ShoppingCart, CheckSquare, Square,
  Archive, ArchiveRestore, ChevronDown, ChevronUp, Edit3
} from 'lucide-react';

export default function ShoppingList() {
  const { shoppingLists, setShoppingLists } = usePlanner();
  const [showAdd, setShowAdd] = useState(false);
  const [listName, setListName] = useState('');

  const handleAddList = () => {
    if (!listName.trim()) return;
    const newList = {
      id: uuidv4(),
      name: listName,
      items: [],
      archived: false,
      createdAt: new Date().toISOString(),
    };
    setShoppingLists([newList, ...shoppingLists]);
    setListName('');
    setShowAdd(false);
  };

  const addItem = (listId, text, category = 'food', quantity = '') => {
    if (!text.trim()) return;
    setShoppingLists(shoppingLists.map(l => l.id === listId ? {
      ...l, items: [...l.items, { id: uuidv4(), text, category, quantity, bought: false }]
    } : l));
  };

  const toggleItem = (listId, itemId) => {
    setShoppingLists(shoppingLists.map(l => l.id === listId ? {
      ...l, items: l.items.map(i => i.id === itemId ? { ...i, bought: !i.bought } : i)
    } : l));
  };

  const deleteItem = (listId, itemId) => {
    setShoppingLists(shoppingLists.map(l => l.id === listId ? {
      ...l, items: l.items.filter(i => i.id !== itemId)
    } : l));
  };

  const archiveList = (listId) => {
    setShoppingLists(shoppingLists.map(l => l.id === listId ? { ...l, archived: true } : l));
  };

  const unarchiveList = (listId) => {
    setShoppingLists(shoppingLists.map(l => l.id === listId ? { ...l, archived: false } : l));
  };

  const renameList = (listId, name) => {
    if (!name.trim()) return;
    setShoppingLists(shoppingLists.map(l => l.id === listId ? { ...l, name: name.trim() } : l));
  };

  const deleteList = (listId) => {
    setShoppingLists(shoppingLists.filter(l => l.id !== listId));
  };

  const activeLists = shoppingLists.filter(l => !l.archived);
  const archivedLists = shoppingLists.filter(l => l.archived);
  const [showArchive, setShowArchive] = useState(false);

  return (
    <div className="shopping-page">
      <div className="section-header">
        <h2>Списки покупок</h2>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Новый список
        </button>
      </div>

      {activeLists.length === 0 && !showAdd ? (
        <div className="empty-state">
          <ShoppingCart size={48} />
          <p>Нет активных списков покупок</p>
        </div>
      ) : (
        <div className="shopping-lists">
          {activeLists.map(list => (
            <ShoppingListCard
              key={list.id}
              list={list}
              onAddItem={addItem}
              onToggleItem={toggleItem}
              onDeleteItem={deleteItem}
              onArchive={archiveList}
              onRename={renameList}
              onDelete={deleteList}
            />
          ))}
        </div>
      )}

      {archivedLists.length > 0 && (
        <div className="archive-section">
          <button className="btn-text" onClick={() => setShowArchive(!showArchive)}>
            <Archive size={16} /> Архив ({archivedLists.length})
            {showArchive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showArchive && (
            <div className="shopping-lists archived">
              {archivedLists.map(list => (
                <ShoppingListCard
                  key={list.id}
                  list={list}
                  onAddItem={addItem}
                  onToggleItem={toggleItem}
                  onDeleteItem={deleteItem}
                  onUnarchive={unarchiveList}
                  onRename={renameList}
                  onDelete={deleteList}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={shakeOnOverlayClick}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Новый список</h3>
              <button className="btn-icon" onClick={() => setShowAdd(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Название</label>
                <input
                  type="text" value={listName} onChange={e => setListName(e.target.value)}
                  placeholder="Продукты на неделю..." autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAddList(); }}
                />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowAdd(false)}>Отмена</button>
                <button className="btn-primary" onClick={handleAddList}><Check size={16} /> Создать</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingListCard({ list, onAddItem, onToggleItem, onDeleteItem, onArchive, onUnarchive, onRename, onDelete, isArchived }) {
  const [newItem, setNewItem] = useState('');
  const [newCat, setNewCat] = useState('food');
  const [newQty, setNewQty] = useState('');
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(list.name);

  const startEdit = () => { setNameInput(list.name); setEditing(true); };
  const saveName = () => {
    if (nameInput.trim()) onRename(list.id, nameInput);
    setEditing(false);
  };

  const bought = list.items.filter(i => i.bought).length;
  const total = list.items.length;
  const grouped = {};
  list.items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  const handleAdd = () => {
    onAddItem(list.id, newItem, newCat, newQty);
    setNewItem('');
    setNewQty('');
  };

  return (
    <div className={`shopping-list-card ${isArchived ? 'archived' : ''}`}>
      <div className="list-card-header">
        <div className="list-title-wrap">
          {editing ? (
            <input
              className="list-name-edit"
              value={nameInput}
              autoFocus
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
              onBlur={saveName}
            />
          ) : (
            <h3>{list.name}</h3>
          )}
          <span className="list-meta">
            {format(new Date(list.createdAt), 'd MMM', { locale: ru })} • {bought}/{total} куплено
          </span>
        </div>
        <div className="list-actions">
          {onRename && !editing && (
            <button className="btn-icon-sm" onClick={startEdit} title="Переименовать">
              <Edit3 size={14} />
            </button>
          )}
          {editing && (
            <button className="btn-icon-sm" onMouseDown={e => e.preventDefault()} onClick={saveName} title="Сохранить">
              <Check size={14} />
            </button>
          )}
          {!isArchived && onArchive && (
            <button className="btn-icon-sm" onClick={() => onArchive(list.id)} title="Архивировать">
              <Archive size={14} />
            </button>
          )}
          {isArchived && onUnarchive && (
            <button className="btn-icon-sm" onClick={() => onUnarchive(list.id)} title="Вернуть из архива">
              <ArchiveRestore size={14} />
            </button>
          )}
          <button className="btn-icon-sm" onClick={() => onDelete(list.id)} title="Удалить">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {total > 0 && (
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div className="progress-fill green" style={{ width: `${Math.round((bought / total) * 100)}%` }} />
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([cat, items]) => {
        const catInfo = SHOPPING_CATEGORIES[cat] || SHOPPING_CATEGORIES.other;
        return (
          <div key={cat} className="shopping-group">
            <div className="shopping-group-header">
              {catInfo.emoji} {catInfo.label}
            </div>
            {items.map(item => (
              <div key={item.id} className={`checklist-item ${item.bought ? 'done' : ''}`}>
                <button className="check-btn" onClick={() => onToggleItem(list.id, item.id)}>
                  {item.bought ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
                <span>{item.text}</span>
                {item.quantity && <span className="item-qty">{item.quantity}</span>}
                <button className="btn-icon-xs" onClick={() => onDeleteItem(list.id, item.id)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {!isArchived && (
        <div className="add-shopping-item">
          <input
            type="text" value={newItem} onChange={e => setNewItem(e.target.value)}
            placeholder="Добавить товар..."
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <input
            type="text" value={newQty} onChange={e => setNewQty(e.target.value)}
            placeholder="Кол-во" className="qty-input"
          />
          <select value={newCat} onChange={e => setNewCat(e.target.value)} className="cat-select">
            {Object.entries(SHOPPING_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
          <button className="btn-icon-sm" onClick={handleAdd}><Plus size={14} /></button>
        </div>
      )}
    </div>
  );
}
