import { useState, useEffect } from 'react';
import { config } from '../config';

const TOKEN_KEY = 'fp_tokens';

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      exchangeCodeForTokens(code);
    } else {
      loadStoredTokens();
    }
  }, []);

  async function exchangeCodeForTokens(code) {
    try {
      const response = await fetch(`https://${config.cognito.domain}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.cognito.clientId,
          code,
          redirect_uri: config.cognito.redirectUri
        })
      });

      const tokens = await response.json();
      if (tokens.id_token) {
        localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
        window.history.replaceState({}, '', '/family-bank/');
        processTokens(tokens);
      } else {
        console.error('Token exchange failed:', tokens);
      }
    } catch (err) {
      console.error('Token exchange failed', err);
    } finally {
      setLoading(false);
    }
  }

  function loadStoredTokens() {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const tokens = JSON.parse(stored);
      const claims = parseJwt(tokens.id_token);
      if (claims && claims.exp * 1000 > Date.now()) {
        processTokens(tokens);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setLoading(false);
  }

  function processTokens(tokens) {
    const claims = parseJwt(tokens.id_token);
    if (!claims) return;

    const groups = claims['cognito:groups'] || [];
    setUser({
      id: claims.sub,
      email: claims.email,
      name: claims.name || claims.given_name || claims.email.split('@')[0],
      picture: claims.picture,
      isBanker: Array.isArray(groups) 
        ? groups.includes('bankers')
        : typeof groups === 'string' 
          ? groups.replace(/[\[\]]/g, '').split(' ').includes('bankers')
          : false,
      accessToken: tokens.access_token,
      idToken: tokens.id_token
    });
  }

  function login() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.cognito.clientId,
      redirect_uri: config.cognito.redirectUri,
      scope: config.cognito.scopes,
      identity_provider: 'Google'
    });
    window.location.href = `https://${config.cognito.domain}/oauth2/authorize?${params}`;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    const params = new URLSearchParams({
      client_id: config.cognito.clientId,
      logout_uri: config.cognito.logoutUri
    });
    window.location.href = `https://${config.cognito.domain}/logout?${params}`;
  }

  async function apiFetch(path, options = {}) {
    const stored = localStorage.getItem(TOKEN_KEY);
    const tokens = stored ? JSON.parse(stored) : {};

    const response = await fetch(`${config.api.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.id_token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/family-bank/';
      return;
    }

    return response;
  }

  return { user, loading, login, logout, apiFetch };
}
