import React, { useState, useEffect } from 'react';

export default function Store({ apiFetch, balance, onPurchase }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);
  const [celebration, setCelebration] = useState(false);

  useEffect(() => {
    apiFetch('/store')
      .then(r => r.json())
      .then(d => { setItems(d.items?.filter(i => i.available) || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function redeem(item) {
    if (balance < item.pointCost) return;
    setRedeeming(item.itemId);
    try {
      const res = await apiFetch('/store/redeem', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.itemId })
      });
      if (res.ok) {
        setCelebration(true);
        setTimeout(() => setCelebration(false), 3000);
        onPurchase();
      }
    } finally {
      setRedeeming(null);
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading store... 🛍️</div>;

  return (
    <div>
      <style>{`
        @keyframes celebrationPop {
          0% { transform: scale(0) translateY(0); opacity: 1; }
          100% { transform: scale(1.5) translateY(-100px); opacity: 0; }
        }
      `}</style>

      {celebration && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 999, textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: '5rem', animation: 'celebrationPop 2s ease-out forwards' }}>🎉</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--purple)', marginTop: 8 }}>Redeemed!</div>
        </div>
      )}

      <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 8 }}>🛍️ The Store</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 20, fontWeight: 600 }}>
        You have <span style={{ color: 'var(--purple)', fontWeight: 900 }}>⭐ {balance?.toLocaleString()}</span> points to spend!
      </p>

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏗️</div>
          <div style={{ fontWeight: 700, color: 'var(--muted)' }}>Store coming soon!</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {items.map(item => {
            const canAfford = balance >= item.pointCost;
            return (
              <div key={item.itemId} className="card" style={{
                opacity: canAfford ? 1 : 0.6,
                transition: 'transform 0.2s',
                display: 'flex', flexDirection: 'column'
              }}>
                <div style={{ fontSize: '3.5rem', marginBottom: 12, textAlign: 'center' }}>{item.emoji}</div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 4 }}>{item.name}</div>
                {item.description && <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 12, flex: 1 }}>{item.description}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div style={{ fontWeight: 900, color: 'var(--purple)', fontSize: '1.2rem' }}>
                    ⭐ {item.pointCost.toLocaleString()}
                  </div>
                  <button
                    className="btn btn-purple"
                    style={{ padding: '10px 20px', fontSize: '0.9rem' }}
                    onClick={() => redeem(item)}
                    disabled={!canAfford || redeeming === item.itemId}
                  >
                    {redeeming === item.itemId ? '...' : canAfford ? '✨ Get It!' : '🔒 Need more'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}