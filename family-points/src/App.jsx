import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  const { user, loading, login, logout, apiFetch } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '2rem' }}>
        ⭐ Loading...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return <Dashboard user={user} onLogout={logout} apiFetch={apiFetch} />;
}