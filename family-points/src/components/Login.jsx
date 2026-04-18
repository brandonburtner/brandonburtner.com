import React from 'react';

export default function Login({ onLogin }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FFD93D 0%, #FF6B9D 50%, #A855F7 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Floating stars */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        {['⭐','🌟','✨','💫','🌈','🎉'].map((e, i) => (
          <span key={i} style={{
            position: 'absolute',
            fontSize: `${1.5 + Math.random() * 2}rem`,
            left: `${10 + i * 15}%`,
            top: `${10 + (i % 3) * 25}%`,
            animation: `float ${3 + i * 0.5}s ease-in-out infinite alternate`,
            opacity: 0.6
          }}>{e}</span>
        ))}
      </div>

      <style>{`
        @keyframes float {
          from { transform: translateY(0px) rotate(-5deg); }
          to { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>

      <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '5rem', marginBottom: '12px' }}>🏦</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#1E1B18', marginBottom: '8px' }}>
          Family Points Bank
        </h1>
        <p style={{ color: '#78716C', marginBottom: '32px', fontSize: '1.1rem' }}>
          Earn points, buy awesome stuff! 🎁
        </p>
        <button
          className="btn btn-primary"
          onClick={onLogin}
          style={{ width: '100%', fontSize: '1.1rem', padding: '16px', animation: 'bounce 2s ease-in-out infinite' }}
        >
          🚀 Sign In with Google
        </button>
      </div>
    </div>
  );
}