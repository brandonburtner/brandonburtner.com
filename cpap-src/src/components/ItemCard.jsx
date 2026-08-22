import React, { useState } from 'react';
import {
  statusFor, fmtEvery, fmtLastPerformed, fmtDate, daysToParts, partsToDays, UNITS,
} from '../format.js';

export default function ItemCard({ item, tick, busy, onPerform, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const parts = daysToParts(item.intervalDays);
  const [value, setValue] = useState(parts.value);
  const [unit, setUnit] = useState(parts.unit);

  const status = statusFor(item, tick);

  function saveInterval() {
    const days = partsToDays(Number(value) || 1, unit);
    setEditing(false);
    if (days !== item.intervalDays) onUpdate(item.id, { intervalDays: days });
  }

  return (
    <div className={`item ${status.tone}`}>
      <div className="item-main">
        <div className="item-head">
          <h3 className="item-name">{item.name}</h3>
          <span className={`pill ${status.tone}`}>
            {status.tone === 'overdue' ? '● Past due' : status.text}
          </span>
        </div>
        {item.description && <p className="item-desc">{item.description}</p>}

        <div className="item-meta">
          {!editing ? (
            <button className="link" onClick={() => setEditing(true)} title="Edit frequency">
              {fmtEvery(item.intervalDays)} <span className="edit-ico">✎</span>
            </button>
          ) : (
            <span className="interval-edit">
              Every
              <input
                type="number" min="1" value={value}
                onChange={(e) => setValue(e.target.value)}
                className="num"
              />
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
              </select>
              <button className="mini primary" onClick={saveInterval}>Save</button>
              <button className="mini" onClick={() => setEditing(false)}>Cancel</button>
            </span>
          )}
          <span className="dot">·</span>
          <span className="muted" title={fmtDate(item.lastPerformedAt)}>
            Last done {fmtLastPerformed(item.lastPerformedAt, tick)}
          </span>
        </div>

        <div className="item-status-line">
          {status.tone === 'overdue' ? (
            <span className="overdue-text">Needs to be performed now</span>
          ) : (
            <span className="muted">Next due {fmtDate(item.dueAt)}</span>
          )}
        </div>
      </div>

      <div className="item-actions">
        <button
          className={`perform ${status.tone === 'overdue' ? 'urgent' : ''}`}
          disabled={busy}
          onClick={() => onPerform(item.id)}
        >
          ✓ Mark done
        </button>
        {onDelete && (
          <button className="ghost-del" title="Delete item" onClick={() => onDelete(item.id)}>
            🗑
          </button>
        )}
      </div>
    </div>
  );
}
