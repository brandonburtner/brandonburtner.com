import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { CATEGORIES, CATEGORY_META } from './config.js';
import { initAuth, getProfile, signOut } from './auth.js';
import * as api from './api.js';
import { subscribe as pushSubscribe, permissionState, getExistingSubscription, pushSupported } from './push.js';
import Login from './components/Login.jsx';
import ItemCard from './components/ItemCard.jsx';
import Settings from './components/Settings.jsx';

export default function App() {
  const [profile, setProfile] = useState(getProfile());
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(Date.now());
  const [permission, setPermission] = useState(permissionState());

  // live-updating clock for countdowns
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // init Google auth
  useEffect(() => {
    initAuth((p) => setProfile(p)).finally(() => setAuthReady(true));
  }, []);

  const flash = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.getState();
      setData(s);
    } catch (e) {
      if (e.status === 401) { setProfile(null); }
      else setError(e.message || 'Could not load your data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // load data once signed in; sync push status
  useEffect(() => {
    if (!profile) { setData(null); return; }
    loadState();
    getExistingSubscription().then((sub) => {
      if (sub) setData((d) => (d ? { ...d, pushEnabled: true } : d));
    }).catch(() => {});
  }, [profile, loadState]);

  // generic mutation runner: most endpoints return fresh state
  const run = useCallback(async (fn, okMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res && res.items) setData(res);
      if (okMsg) flash(okMsg);
      return res;
    } catch (e) {
      flash(e.message || 'Something went wrong.', 'err');
      throw e;
    } finally {
      setBusy(false);
    }
  }, [flash]);

  const enablePush = useCallback(async () => {
    if (!pushSupported) { flash('This browser can’t do notifications.', 'err'); return; }
    setBusy(true);
    try {
      const sub = await pushSubscribe();
      await api.subscribePush(sub);
      setPermission(permissionState());
      setData((d) => (d ? { ...d, pushEnabled: true } : d));
      flash('Notifications enabled on this device.');
    } catch (e) {
      setPermission(permissionState());
      flash(e.message || 'Could not enable notifications.', 'err');
    } finally {
      setBusy(false);
    }
  }, [flash]);

  const testPush = useCallback(async () => {
    try {
      const r = await run(() => api.testPush());
      flash(r?.sent ? 'Test notification sent — check your device.' : 'No devices subscribed yet.', r?.sent ? 'ok' : 'err');
    } catch { /* handled in run */ }
  }, [run, flash]);

  const grouped = useMemo(() => {
    const g = { Maintenance: [], Replacement: [], Orders: [] };
    (data?.items || []).forEach((it) => { (g[it.category] || (g[it.category] = [])).push(it); });
    return g;
  }, [data]);

  const overdueCount = useMemo(
    () => (data?.items || []).filter((i) => i.dueAt - tick <= 0).length,
    [data, tick]
  );

  if (!profile) {
    return (
      <>
        <Login />
        {!authReady && <div className="boot-hint">Connecting to Google…</div>}
      </>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-ico" aria-hidden>🌙</span>
          <span className="brand-name">CPAP Reminders</span>
        </div>
        <div className="top-actions">
          <button className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}>⚙️</button>
          <div className="user">
            {profile.picture
              ? <img src={profile.picture} alt="" className="avatar" referrerPolicy="no-referrer" />
              : <span className="avatar placeholder">{(profile.name || '?')[0]}</span>}
            <button className="link small" onClick={() => { signOut(); setProfile(null); }}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="content">
        <div className="summary">
          {overdueCount > 0
            ? <span className="summary-badge overdue">{overdueCount} item{overdueCount === 1 ? '' : 's'} need attention</span>
            : <span className="summary-badge ok">You’re all caught up 🎉</span>}
        </div>

        {loading && !data && <div className="loading">Loading your schedule…</div>}
        {error && <div className="error-box">{error} <button className="link" onClick={loadState}>Retry</button></div>}

        {data && CATEGORIES.map((cat) => {
          const list = grouped[cat] || [];
          if (list.length === 0) return null;
          const meta = CATEGORY_META[cat];
          return (
            <section key={cat} className="cat">
              <div className="cat-head">
                <h2>{meta.icon} {meta.label}</h2>
                <span className="cat-blurb">{meta.blurb}</span>
              </div>
              <div className="cat-items">
                {list.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    tick={tick}
                    busy={busy}
                    onPerform={(id) => run(() => api.performItem(id), 'Marked done — timer reset.')}
                    onUpdate={(id, patch) => run(() => api.updateItem(id, patch))}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {settingsOpen && data && (
        <Settings
          notifications={data.notifications}
          items={data.items}
          pushEnabled={data.pushEnabled}
          permission={permission}
          busy={busy}
          onAdd={(d) => run(() => api.addNotification(d), 'Reminder added.')}
          onUpdate={(id, patch) => run(() => api.updateNotification(id, patch))}
          onDelete={(id) => run(() => api.deleteNotification(id), 'Reminder deleted.')}
          onEnablePush={enablePush}
          onTestPush={testPush}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
