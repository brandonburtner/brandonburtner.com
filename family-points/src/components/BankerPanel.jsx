import React, { useState } from 'react';
import { config } from '../config';

const QUICK_REASONS = [
  { label: '🧹 Chores', desc: 'Completed chores' },
  { label: '📚 Homework', desc: 'Finished homework' },
  { label: '😇 Good behavior', desc: 'Great behavior!' },
  { label: '🌟 Extra effort', desc: 'Went above and beyond!' },
  { label: '🤝 Helping others', desc: 'Helped someone out' },
];

export default function BankerPanel({ apiFetch, onPointsAdded }) {
  const [points, setPoints] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('deposit');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const kidUserId = config.users.kid.userId;

  async function submit() {
    if (!points || !description || !kidUserId) return;
    setLoading(true);
    try {
      const res = await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          userId: kidUserId,
          points: parseInt(points),
          description,
          type
        })
      });
      if (res.ok) {
        setSuccess(true);
        setPoints('');
        setDescription('');
        setType('deposit');
        onPointsAdded();
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 20 }}>💰 Add / Adjust Points</h2>

      {success && (
        <div className="card" style={{ background: '#D1FAE5', border: '2px solid #10B981', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>✅</div>
          <div style={{ fontWeight: 800, color: '#065F46' }}>Points updated!</div>
        </div>
      )}

      {!kidUserId && (
        <div className="card" style={{ background: '#FEF3C7', border: '2px solid #F59E0B', marginBottom: 20 }}>
          <div style={{ fontWeight: 800, color: '#92400E' }}>⚠️ Setup needed!</div>
          <div style={{ color: '#92400E', marginTop: 4 }}>Open <code>src/config.js</code> and add your son's Cognito user ID to <code>config.users.kid.userId</code>. He needs to log in once first.</div>
        </div>
      )}

      <div className="card">
        {/* Quick reason buttons */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 800, display: 'block', marginBottom: 10 }}>Quick Reasons</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {QUICK_REASONS.map(r => (
              <button key={r.label} className="btn" style={{
                padding: '8px 14px', fontSize: '0.85rem', fontWeight: 700,
                background: description === r.desc ? 'var(--yellow)' : '#f5f0e8',
                borderRadius: 50
              }} onClick={() => setDescription(r.desc)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ fontWeight: 800, display: 'block', marginBottom: 6 }}>Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What did they do?"
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '2px solid #e0dbd0', fontSize: '1rem', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontWeight: 800, display: 'block', marginBottom: 6 }}>Points</label>
              <input
                type="number"
                value={points}
                onChange={e => setPoints(e.target.value)}
                placeholder="e.g. 10"
                min="1"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '2px solid #e0dbd0', fontSize: '1rem', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 800, display: 'block', marginBottom: 6 }}>Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '2px solid #e0dbd0', fontSize: '1rem', outline: 'none' }}
              >
                <option value="deposit">⬆️ Add Points</option>
                <option value="correction">🔧 Remove Points (correction)</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-success"
            onClick={submit}
            disabled={loading || !points || !description}
            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
          >
            {loading ? 'Saving...' : type === 'deposit' ? '⭐ Add Points!' : '🔧 Apply Correction'}
          </button>
        </div>
      </div>
    </div>
  );
}