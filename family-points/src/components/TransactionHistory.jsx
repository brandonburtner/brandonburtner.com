import React, { useState, useEffect } from 'react';

const typeConfig = {
  deposit: { icon: '⬆️', color: '#10B981', label: 'Earned', sign: '+' },
  redemption: { icon: '🛍️', color: '#FF6B9D', label: 'Spent', sign: '' },
  correction: { icon: '🔧', color: '#F59E0B', label: 'Correction', sign: '' }
};

export default function TransactionHistory({ apiFetch }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/transactions')
      .then(r => r.json())
      .then(d => { setTransactions(d.transactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading... ⭐</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 20 }}>📜 Point History</h2>
      {transactions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🌱</div>
          <div style={{ fontWeight: 700, color: 'var(--muted)' }}>No transactions yet!</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {transactions.map((tx, i) => {
            const cfg = typeConfig[tx.type] || typeConfig.deposit;
            const isPositive = tx.points > 0;
            return (
              <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '1.8rem' }}>{cfg.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{tx.description}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>
                    {new Date(tx.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ fontWeight: 900, fontSize: '1.2rem', color: isPositive ? '#10B981' : '#FF6B9D' }}>
                  {isPositive ? '+' : ''}{tx.points} ⭐
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}