import React, { useState } from 'react';
import { describeNotification } from '../format.js';

function hoursToAmount(h) {
  const abs = Math.abs(h);
  if (abs !== 0 && abs % 24 === 0) return { amount: abs / 24, unit: 'days' };
  return { amount: abs, unit: 'hours' };
}
const toHours = (amount, unit) => Math.max(1, Math.round(Number(amount) || 0)) * (unit === 'days' ? 24 : 1);

function NotificationEditor({ initial, items, onSave, onCancel }) {
  const off = initial?.offsetHours ?? 0;
  const startMode = off === 0 ? 'at' : off > 0 ? 'after' : 'before';
  const offA = hoursToAmount(off || 24);
  const everyA = hoursToAmount(initial?.everyHours || 24);
  const scope0 = initial?.scope || { type: 'all' };

  const [label, setLabel] = useState(initial?.label || '');
  const [mode, setMode] = useState(startMode);
  const [offAmount, setOffAmount] = useState(offA.amount);
  const [offUnit, setOffUnit] = useState(offA.unit);
  const [recurring, setRecurring] = useState(initial?.recurring || false);
  const [everyAmount, setEveryAmount] = useState(everyA.amount);
  const [everyUnit, setEveryUnit] = useState(everyA.unit);
  const [scopeType, setScopeType] = useState(scope0.type);
  const [scopeCat, setScopeCat] = useState(scope0.category || 'Maintenance');
  const [scopeItem, setScopeItem] = useState(scope0.itemId || (items[0]?.id ?? ''));

  function save() {
    const offsetHours = mode === 'at' ? 0
      : mode === 'after' ? toHours(offAmount, offUnit)
      : -toHours(offAmount, offUnit);
    const scope = scopeType === 'all' ? { type: 'all' }
      : scopeType === 'category' ? { type: 'category', category: scopeCat }
      : { type: 'item', itemId: scopeItem };
    onSave({
      label: label.trim() || 'Notification',
      offsetHours,
      recurring,
      everyHours: recurring ? toHours(everyAmount, everyUnit) : 0,
      scope,
      enabled: initial?.enabled ?? true,
    });
  }

  return (
    <div className="notif-editor">
      <label className="fld">
        <span>Name</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Two days before due" />
      </label>

      <label className="fld">
        <span>When it fires</span>
        <div className="row">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="at">As soon as due</option>
            <option value="after">After due</option>
            <option value="before">Before due</option>
          </select>
          {mode !== 'at' && (
            <>
              <input className="num" type="number" min="1" value={offAmount} onChange={(e) => setOffAmount(e.target.value)} />
              <select value={offUnit} onChange={(e) => setOffUnit(e.target.value)}>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </>
          )}
        </div>
      </label>

      <label className="fld checkline">
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        <span>Repeat while still overdue</span>
      </label>
      {recurring && (
        <label className="fld">
          <span>Repeat every</span>
          <div className="row">
            <input className="num" type="number" min="1" value={everyAmount} onChange={(e) => setEveryAmount(e.target.value)} />
            <select value={everyUnit} onChange={(e) => setEveryUnit(e.target.value)}>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
        </label>
      )}

      <label className="fld">
        <span>Applies to</span>
        <div className="row">
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
            <option value="all">Every item</option>
            <option value="category">A category</option>
            <option value="item">One item</option>
          </select>
          {scopeType === 'category' && (
            <select value={scopeCat} onChange={(e) => setScopeCat(e.target.value)}>
              <option>Maintenance</option><option>Replacement</option><option>Orders</option>
            </select>
          )}
          {scopeType === 'item' && (
            <select value={scopeItem} onChange={(e) => setScopeItem(e.target.value)}>
              {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
            </select>
          )}
        </div>
      </label>

      <div className="editor-actions">
        <button className="mini primary" onClick={save}>Save</button>
        <button className="mini" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function Settings({
  notifications, items, pushEnabled, permission, busy,
  onAdd, onUpdate, onDelete, onEnablePush, onTestPush, onClose,
}) {
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <section className="settings-section">
          <h3>Notifications on this device</h3>
          {permission === 'denied' && (
            <p className="warn">Notifications are blocked in your browser settings for this site. Re-enable them there to receive reminders.</p>
          )}
          <div className="device-row">
            <span className={`status-dot ${pushEnabled ? 'on' : 'off'}`} />
            <span>{pushEnabled ? 'This device is receiving push notifications.' : 'Push not yet enabled on this device.'}</span>
          </div>
          <div className="row">
            {!pushEnabled && (
              <button className="btn primary" disabled={busy} onClick={onEnablePush}>
                Enable notifications
              </button>
            )}
            <button className="btn" disabled={busy || !pushEnabled} onClick={onTestPush}>
              Send test notification
            </button>
          </div>
        </section>

        <section className="settings-section">
          <div className="section-head">
            <h3>Reminder rules</h3>
            {!adding && <button className="btn small" onClick={() => { setAdding(true); setEditingId(null); }}>+ Add</button>}
          </div>
          <p className="muted small">Rules are based on each maintenance item's timer. The two defaults are below — edit or delete them freely.</p>

          {adding && (
            <div className="notif-card editing">
              <NotificationEditor
                items={items}
                onSave={(data) => { onAdd(data); setAdding(false); }}
                onCancel={() => setAdding(false)}
              />
            </div>
          )}

          <ul className="notif-list">
            {notifications.map((n) => (
              <li key={n.id} className={`notif-card ${n.enabled ? '' : 'disabled'}`}>
                {editingId === n.id ? (
                  <NotificationEditor
                    initial={n} items={items}
                    onSave={(data) => { onUpdate(n.id, data); setEditingId(null); }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="notif-info">
                      <div className="notif-title-row">
                        <label className="switch" title={n.enabled ? 'Enabled' : 'Disabled'}>
                          <input type="checkbox" checked={n.enabled} onChange={(e) => onUpdate(n.id, { enabled: e.target.checked })} />
                          <span className="slider" />
                        </label>
                        <strong>{n.label}</strong>
                      </div>
                      <p className="muted small">{describeNotification(n)}</p>
                    </div>
                    <div className="notif-actions">
                      <button className="mini" onClick={() => { setEditingId(n.id); setAdding(false); }}>Edit</button>
                      <button className="mini danger" onClick={() => onDelete(n.id)}>Delete</button>
                    </div>
                  </>
                )}
              </li>
            ))}
            {notifications.length === 0 && !adding && (
              <li className="muted small">No reminder rules. Add one to start getting notified.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
