// Google Identity Services (GIS) wrapper. Produces short-lived ID tokens (JWTs)
// that the backend verifies. We keep the latest token in memory + localStorage
// and transparently re-prompt (One Tap) when it expires.
import { GOOGLE_CLIENT_ID, DEV_MOCK } from './config.js';

const TOKEN_KEY = 'cpap_id_token';
let currentToken = localStorage.getItem(TOKEN_KEY) || null;
let onChange = () => {};

export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(payload))));
  } catch {
    return null;
  }
}

function isExpired(token) {
  const c = decodeJwt(token);
  if (!c || !c.exp) return true;
  return Date.now() >= c.exp * 1000 - 30_000; // 30s early margin
}

export function getValidToken() {
  if (DEV_MOCK) return 'mock-token';
  if (currentToken && !isExpired(currentToken)) return currentToken;
  return null;
}

export function getProfile() {
  if (DEV_MOCK) {
    return { name: 'Dev User', email: 'dev@example.com', picture: '' };
  }
  const t = getValidToken() || currentToken;
  const c = t ? decodeJwt(t) : null;
  return c ? { name: c.name, email: c.email, picture: c.picture } : null;
}

function setToken(token) {
  currentToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  onChange(getProfile());
}

function whenGsiReady() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve();
    const t = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(t);
        resolve();
      }
    }, 100);
  });
}

let initialized = false;
export async function initAuth(changeHandler) {
  onChange = changeHandler || (() => {});
  if (DEV_MOCK) {
    onChange(getProfile());
    return;
  }
  await whenGsiReady();
  if (!initialized) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: true,
      callback: (resp) => setToken(resp.credential),
    });
    initialized = true;
  }
  // If we already have a valid token, keep it; otherwise nudge One Tap.
  if (!getValidToken()) window.google.accounts.id.prompt();
  else onChange(getProfile());
}

export async function renderButton(el) {
  if (DEV_MOCK || !el) return;
  await whenGsiReady();
  window.google.accounts.id.renderButton(el, {
    theme: 'filled_blue', size: 'large', shape: 'pill',
    text: 'signin_with', logo_alignment: 'left', width: 260,
  });
  window.google.accounts.id.prompt();
}

// Ask GIS for a fresh token (used when the API returns 401). Resolves to a new
// token or null if the user must interact.
export function refreshToken() {
  return new Promise((resolve) => {
    if (DEV_MOCK) return resolve('mock-token');
    if (!initialized || !window.google?.accounts?.id) return resolve(null);
    let done = false;
    const prev = onChange;
    onChange = (p) => { prev(p); };
    // Temporarily wrap callback to capture the refreshed token.
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: true,
      callback: (resp) => {
        setToken(resp.credential);
        if (!done) { done = true; resolve(resp.credential); }
      },
    });
    window.google.accounts.id.prompt((n) => {
      if ((n.isNotDisplayed?.() || n.isSkippedMoment?.()) && !done) {
        done = true;
        resolve(null);
      }
    });
    setTimeout(() => { if (!done) { done = true; resolve(getValidToken()); } }, 4000);
  });
}

export function signOut() {
  if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  setToken(null);
}
