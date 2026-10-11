'use strict';

/**
 * Client TikTok : Login Kit (OAuth web) + Content Posting API (publication de photos).
 * Aucune dépendance externe : on utilise le fetch de Node.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const T = config.tiktok;
const TIMEOUT_MS = 20000;

function isConfigured() {
  return Boolean(T.clientKey && T.clientSecret);
}

function redirectUriFor(origin) {
  return T.redirectUri || `${origin}/auth/tiktok/callback`;
}

function buildAuthorizeUrl({ state, redirectUri }) {
  const url = new URL(T.authorizeUrl);
  url.searchParams.set('client_key', T.clientKey);
  url.searchParams.set('scope', T.scopes);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

async function tokenRequest(endpoint, params) {
  const res = await fetch(`${T.apiBase}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({ client_key: T.clientKey, client_secret: T.clientSecret, ...params }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function exchangeCode(code, redirectUri) {
  const { res, data } = await tokenRequest('/v2/oauth/token/', {
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  if (!data.access_token) {
    throw new Error(`${data.error || `HTTP ${res.status}`}${data.error_description ? ` : ${data.error_description}` : ''}`);
  }
  return data;
}

async function refreshTokens(refreshToken) {
  const { res, data } = await tokenRequest('/v2/oauth/token/', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  if (!data.access_token) {
    throw new Error(`${data.error || `HTTP ${res.status}`}${data.error_description ? ` : ${data.error_description}` : ''}`);
  }
  return data;
}

async function revokeToken(token) {
  try {
    await tokenRequest('/v2/oauth/revoke/', { token });
  } catch {
    // Au mieux : la suppression locale suffit si TikTok ne répond pas
  }
}

// ---------------------------------------------------------------------------
// Stockage des comptes connectés (un fichier JSON, écrit de façon atomique)
// ---------------------------------------------------------------------------

function readStore() {
  try {
    const s = JSON.parse(fs.readFileSync(T.tokensPath, 'utf8'));
    return { accounts: s.accounts || {} };
  } catch {
    return { accounts: {} };
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(T.tokensPath), { recursive: true });
  const tmp = `${T.tokensPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store), { mode: 0o600 });
  fs.renameSync(tmp, T.tokensPath);
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function saveAccount({ tokens, user, sessionToken }) {
  const store = readStore();
  const openId = tokens.open_id || (user && user.open_id);
  store.accounts[openId] = {
    openId,
    displayName: (user && user.display_name) || '',
    avatarUrl: (user && user.avatar_url) || '',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (Number(tokens.expires_in) || 0) * 1000,
    refreshExpiresAt: Date.now() + (Number(tokens.refresh_expires_in) || 0) * 1000,
    scope: tokens.scope || '',
    sessionHash: sessionToken ? sha256(sessionToken) : '',
    connectedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.accounts[openId];
}

function listAccounts() {
  return Object.values(readStore().accounts);
}

function getAccount(openId) {
  return readStore().accounts[openId] || null;
}

/** Le visiteur est-il le propriétaire de cette connexion ? (cookie posé lors de la connexion) */
function sessionOwns(account, sessionToken) {
  return Boolean(account && account.sessionHash && sessionToken && account.sessionHash === sha256(sessionToken));
}

function removeAccount(openId) {
  const store = readStore();
  delete store.accounts[openId];
  writeStore(store);
}

/** Jeton d'accès valide : renouvelé automatiquement s'il expire dans moins de 5 minutes. */
async function getAccessToken(openId) {
  const store = readStore();
  const account = store.accounts[openId];
  if (!account) throw new Error('compte TikTok non connecté');
  if (Date.now() < account.expiresAt - 5 * 60 * 1000) return account.accessToken;
  const tokens = await refreshTokens(account.refreshToken);
  account.accessToken = tokens.access_token;
  account.refreshToken = tokens.refresh_token || account.refreshToken;
  account.expiresAt = Date.now() + (Number(tokens.expires_in) || 0) * 1000;
  account.refreshExpiresAt = Date.now() + (Number(tokens.refresh_expires_in) || 0) * 1000;
  writeStore(store);
  return account.accessToken;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function api(endpoint, { accessToken, method = 'GET', body } = {}) {
  const res = await fetch(`${T.apiBase}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (data.error && data.error.code && data.error.code !== 'ok') {
    throw new Error(`${data.error.code}${data.error.message ? ` : ${data.error.message}` : ''}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data.data || {};
}

async function getUserInfo(accessToken) {
  const data = await api('/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', { accessToken });
  return data.user || {};
}

/** À appeler avant toute publication directe : donne le pseudo et les niveaux de confidentialité autorisés. */
function queryCreatorInfo(accessToken) {
  return api('/v2/post/publish/creator_info/query/', { accessToken, method: 'POST' });
}

/**
 * Publication directe d'une photo (la photo est récupérée par TikTok à l'adresse imageUrl,
 * qui doit appartenir à un préfixe d'URL vérifié dans l'application TikTok).
 */
async function publishPhoto(accessToken, { title, description, privacyLevel, disableComment, imageUrl }) {
  const data = await api('/v2/post/publish/content/init/', {
    accessToken,
    method: 'POST',
    body: {
      media_type: 'PHOTO',
      post_mode: 'DIRECT_POST',
      post_info: {
        title,
        description,
        privacy_level: privacyLevel,
        disable_comment: Boolean(disableComment),
        auto_add_music: true,
        brand_content_toggle: false,
        brand_organic_toggle: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: [imageUrl],
      },
    },
  });
  return data.publish_id;
}

function fetchStatus(accessToken, publishId) {
  return api('/v2/post/publish/status/fetch/', { accessToken, method: 'POST', body: { publish_id: publishId } });
}

module.exports = {
  isConfigured,
  redirectUriFor,
  buildAuthorizeUrl,
  exchangeCode,
  revokeToken,
  saveAccount,
  listAccounts,
  getAccount,
  removeAccount,
  sessionOwns,
  getAccessToken,
  getUserInfo,
  queryCreatorInfo,
  publishPhoto,
  fetchStatus,
};
