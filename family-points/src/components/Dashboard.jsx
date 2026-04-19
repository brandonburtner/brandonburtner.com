import React, { useState, useEffect } from 'react';
import TransactionHistory from './TransactionHistory';
import Store from './Store';
import BankerPanel from './BankerPanel';
import StoreManager from './StoreManager';

const tabs = (isBanker) => [
  { id: 'home', label: '🏠 Home', },
  { id: 'store', label: '🛍️ Store', },
  { id: 'history', label: '📜 History', },
  ...(isBanker ? [
    { id: 'banker', label: '💰 Add Points', },
    { id: 'shopmanager', label: '🏪 Manage Shop', },
  ] : [])
];

export default function Dashboard({ user, onLogout, apiFetch }) {
  const [activeTab, setActiveTab] = useState('home');
  const [balance, setBalance] = useState(null);
  const [balanceAnim, setBalanceAnim] = useState(false);

  useEffect(() => {
    loadBalance();
  }, []);

  async function loadBalance() {
    try {
      const res = await apiFetch('/balance');
      const data = await res.json();
      setBalance(data.balance);
      setBalanceAnim(true);
      setTimeout(() => setBalanceAnim(false), 600);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .balance-pop { animation: popIn 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        .tab-btn { 
          padding: 10px 16px; border-radius: 50px; font-weight: 800; 
          font-size: 0.85rem; background: transparent; color: var(--muted);
          transition: all 0.2s; white-space: nowrap;
        }
        .tab-btn.active { background: var(--yellow); color: var(--text); box-shadow: 0 4px 12px rgba(255,217,61,0.4); }
        .tab-btn:hover:not(.active) { background: #f0ece0; }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #FFD93D, #FF6B35)',
        padding: '20px',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 4px 20px rgba(255,107,53,0.3)'
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user.picture && (
              <img src={user.picture} alt="avatar" style={{ width: 42, height: 42, borderRadius: '50%', border: '3px solid white' }} />
            )}
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1E1B18' }}>
                Hey, {user.name.split(' ')[0]}! {user.isBanker ? '👨‍💼' : '⭐'}
              </div>
              {user.isBanker && <div style={{ fontSize: '0.75rem', color: '#5c4a1e', fontWeight: 700 }}>BANKER</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5c4a1e', marginBottom: 2 }}>YOUR POINTS</div>
            <div
              className={balanceAnim ? 'balance-pop' : ''}
              style={{ fontSize: '2rem', fontWeight: 900, color: '#1E1B18', lineHeight: 1 }}
            >
              {balance === null || balance === undefined ? '...' : `⭐ ${balance.toLocaleString()}`}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'sticky', top: 86, zIndex: 99 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 20px', display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {tabs(user.isBanker).map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button onClick={onLogout} className="tab-btn" style={{ marginLeft: 'auto', color: 'var(--pink)' }}>
            👋 Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        {activeTab === 'home' && (
          <HomeTab user={user} balance={balance} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'store' && (
          <Store apiFetch={apiFetch} balance={balance} onPurchase={loadBalance} />
        )}
        {activeTab === 'history' && (
          <TransactionHistory apiFetch={apiFetch} />
        )}
        {activeTab === 'banker' && user.isBanker && (
          <BankerPanel apiFetch={apiFetch} onPointsAdded={loadBalance} />
        )}
        {activeTab === 'shopmanager' && user.isBanker && (
          <StoreManager apiFetch={apiFetch} />
        )}
      </div>
    </div>
  );
}

function HomeTab({ user, balance, setActiveTab }) {
  const tips = user.isBanker
    ? ["Add points to reward great behavior 🌟", "Manage the shop with fun prizes 🎁", "Check transaction history anytime 📜"]
    : ["Earn points for chores and good behavior!", "Visit the store to spend your points 🛍️", "Check your history to see all your points 📜"];

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Big balance card */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #A855F7, #3B82F6)',
        textAlign: 'center', padding: '40px 24px'
      }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>
          CURRENT BALANCE
        </div>
        <div style={{ fontSize: '4rem', fontWeight: 900, color: 'white', lineHeight: 1.1 }}>
          ⭐ {balance === null || balance === undefined ? '...' : balance?.toLocaleString()}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8, fontWeight: 600 }}>points</div>
      </div>

      {/* Quick action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setActiveTab('store')}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🛍️</div>
          <div style={{ fontWeight: 800 }}>Visit Store</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4 }}>Spend your points</div>
        </div>
        <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setActiveTab('history')}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📜</div>
          <div style={{ fontWeight: 800 }}>History</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4 }}>See all your points</div>
        </div>
      </div>

      {/* Tips */}
      <div className="card">
        <h3 style={{ fontWeight: 900, marginBottom: 16 }}>💡 Quick Tips</h3>
        {tips.map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.2rem' }}>{'⭐🌟✨'.split('').filter((_, j) => j % 2 === 0)[i] || '⭐'}</span>
            <span style={{ fontWeight: 600, color: 'var(--muted)' }}>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
