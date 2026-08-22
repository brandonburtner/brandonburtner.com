import React, { useEffect, useRef } from 'react';
import { renderButton } from '../auth.js';

export default function Login() {
  const btnRef = useRef(null);
  useEffect(() => {
    renderButton(btnRef.current);
  }, []);

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand-mark" aria-hidden>🌙</div>
        <h1>CPAP Reminders</h1>
        <p className="login-sub">
          Stay on top of cleaning, replacements, and reorders — with reminders that
          reach you even when the app is closed.
        </p>
        <div ref={btnRef} className="gsi-btn" />
        <p className="login-fine">
          Sign in with Google. Your maintenance schedule and notifications are private
          to your account.
        </p>
      </div>
    </div>
  );
}
