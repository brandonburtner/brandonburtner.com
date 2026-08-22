// REST client for the CPAP backend. Attaches the Google ID token, and on a 401
// tries one silent token refresh before giving up.
import { API_BASE, DEV_MOCK } from './config.js';
import { getValidToken, refreshToken } from './auth.js';
import * as mock from './mockApi.js';

async function request(method, path, body, _retried = false) {
  if (DEV_MOCK) return mock.handle(method, path, body);

  let token = getValidToken();
  if (!token && !_retried) {
    token = await refreshToken();
  }
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !_retried) {
    const fresh = await refreshToken();
    if (fresh) return request(method, path, body, true);
    const err = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch { /* ignore */ }
    const err = new Error(detail || `request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? {} : res.json();
}

export const getState = () => request('GET', '/state');
export const performItem = (id) => request('POST', `/items/${id}/perform`);
export const updateItem = (id, patch) => request('PATCH', `/items/${id}`, patch);
export const addItem = (data) => request('POST', '/items', data);
export const deleteItem = (id) => request('DELETE', `/items/${id}`);
export const addNotification = (data) => request('POST', '/notifications', data);
export const updateNotification = (id, patch) =>
  request('PATCH', `/notifications/${id}`, patch);
export const deleteNotification = (id) => request('DELETE', `/notifications/${id}`);
export const subscribePush = (subscription) =>
  request('POST', '/push/subscribe', { subscription });
export const testPush = () => request('POST', '/push/test');
