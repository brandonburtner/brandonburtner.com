import React, { useState, useEffect } from 'react';

const EMOJI_OPTIONS = ['🎮','🍦','🎬','📱','🎨','🚲','🏊','🎪','🍕','🎁','🛹','🎲','📚','🎤','🌈'];

export default function StoreManager({ apiFetch }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', pointCost: '', emoji: '🎁', available: true });

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    const res = await apiFetch('/store');
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  function startEdit(item) {
    setEditing(item.itemId);
    setForm({ name: item.name, description: item.description, pointCost: item.pointCost, emoji: item.emoji, available: item.available });
  }

  function startNew() {
    setEditing('new');
    setForm({ name: '', description: '', pointCost: '', emoji: '🎁', available: true });
  }

  async function save() {
    await apiFetch('/store/manage', {
      method: 'POST',
      body: JSON.stringify({
        action: 'upsert',
        item: {
          ...(editing !== 'new' ? { itemId: editing } : {}),
          name: form.name,
          description: form.description,
          pointCost: parseInt(form.pointCost),
          emoji: form.emoji,
          available: form.available
        }
      })
    });
    setEditing(null);
    loadItems();
  }

  async function deleteItem(itemId) {
    if (!confirm('Delete this item?')) return;
    await apiFetch('/store/manage', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', item: { itemId } })
    });
    loadItems();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading... 🏪</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>🏪 Manage Shop</h2>
        <button className="btn btn-success" onClick={startNew}>+ Add Item</button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid var(--yellow)' }}>
          <h3 style={{ fontWeight: 900, marginBottom: 16 }}>{editing === 'new' ? '✨ New Item' : '✏️ Edit Item'}</h3>

          {/* Emoji picker */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 800, display: 'block', marginBottom: 6 }}>Emoji</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                  style={{ fontSize: '1.5rem', width: 42, height: 42, borderRadius: 10, background: form.emoji === e ? 'var(--yellow)' : '#f5f0e8', border: 'none', cursor: 'pointer' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {[['name', 'Item Name', 'e.g. Ice cream trip'], ['description', 'Description', 'Optional details'], ['pointCost', 'Point Cost', 'e.g. 50']].map(([field, label, placeholder]) => (
              <div key={field}>
                <label style={{ fontWeight: 800, display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={placeholder}
                  type={field === 'pointCost' ? 'number' : 'text'}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '2px solid #e0dbd0', fontSize: '1rem', outline: 'none' }}
                />
              </div>
            ))}

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} />
              Available in store
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-success" onClick={save} style={{ flex: 1 }}>💾 Save</button>
              <button className="btn" onClick={() => setEditing(null)} style={{ background: '#e0dbd0' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏗️</div>
          <div style={{ fontWeight: 700, color: 'var(--muted)' }}>No items yet. Add your first one!</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {items.map(item => (
            <div key={item.itemId} className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
              <div style={{ fontSize: '2rem' }}>{item.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900 }}>{item.name}</div>
                {item.description && <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{item.description}</div>}
                <div style={{ fontSize: '0.85rem', color: item.available ? 'var(--green)' : 'var(--muted)', marginTop: 2 }}>
                  {item.available ? '✅ Available' : '🔒 Hidden'}
                </div>
              </div>
              <div style={{ fontWeight: 900, color: 'var(--purple)', marginRight: 12 }}>⭐ {item.pointCost}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn" style={{ background: '#e8f0fe', color: 'var(--blue)', padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => startEdit(item)}>✏️ Edit</button>
                <button className="btn btn-danger" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => deleteItem(item.itemId)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}