'use strict';

/**
 * Serveur web du bot (Railway). Routes :
 *   /                          accueil : état, connexion TikTok, liens légaux
 *   /terms, /privacy           conditions d'utilisation et politique de confidentialité (exigées par TikTok)
 *   /auth/tiktok               démarre la connexion TikTok (Login Kit)
 *   /auth/tiktok/callback      retour de TikTok après autorisation
 *   /auth/tiktok/diagnostic    contrôle de la configuration TikTok (sans révéler le secret)
 *   /publish                   publication d'une photo de test sur un compte connecté (mot de passe administrateur)
 *   /media/<jeton>.jpg         photo temporaire que TikTok vient récupérer (adresse vérifiée)
 *   /disconnect                déconnexion d'un compte (révoque le jeton et supprime les données)
 *   /preview, /preview.jpg     aperçu d'un post, sans rien publier
 *   /tiktok<...>.txt           fichier de vérification de propriété demandé par TikTok
 *   /health                    contrôle de santé
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { loadQuotes, pickQuote } = require('./quotes');
const { buildCaption } = require('./caption');
const { buildImagePrompt } = require('./prompt');
const { renderPost, hasAiProvider, providerLabels } = require('./image');
const { ensureFonts, pickStyle, readyCount, STYLES } = require('./fonts');
const tiktok = require('./tiktok');
const legal = require('./legal');

const PORT = Number(process.env.PORT) || 3000;
const quotes = loadQuotes();
const byId = new Map(quotes.map((q) => [String(q.id), q]));
const count = (lang) => quotes.filter((q) => q.lang === lang).length;

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function send(res, status, type, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': type, ...headers });
  res.end(body);
}

function html(res, status, body, headers) {
  return send(res, status, 'text/html; charset=utf-8', body, headers);
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '')
    .split(';')
    .forEach((part) => {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
  return out;
}

function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function originOf(req) {
  if (config.tiktok.publicUrl) return config.tiktok.publicUrl;
  const proto = isHttps(req) ? 'https' : 'http';
  return `${proto}://${req.headers.host}`;
}

function cookie(req, name, value, { path: p = '/', maxAge = 600 } = {}) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=${p}; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 20000) {
        reject(new Error('formulaire trop volumineux'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(new URLSearchParams(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
  });
}

function passwordOk(input) {
  const expected = config.tiktok.adminPassword;
  if (!expected || !input) return false;
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// L'adresse est publique : on limite les générations d'images (elles consomment du quota ou du crédit).
const AI_PREVIEWS_PER_HOUR = 10;
let aiCalls = [];
function aiAllowed() {
  if (!hasAiProvider()) return false;
  const now = Date.now();
  aiCalls = aiCalls.filter((t) => now - t < 3600 * 1000);
  if (aiCalls.length >= AI_PREVIEWS_PER_HOUR) return false;
  aiCalls.push(now);
  return true;
}

// Photos temporaires que TikTok vient chercher (supprimées après 3 h)
const MEDIA_DIR = path.join(os.tmpdir(), 'otaku-media');
function saveMedia(jpeg) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const now = Date.now();
  for (const f of fs.readdirSync(MEDIA_DIR)) {
    try {
      if (now - fs.statSync(path.join(MEDIA_DIR, f)).mtimeMs > 3 * 3600 * 1000) fs.unlinkSync(path.join(MEDIA_DIR, f));
    } catch {
      // ignoré
    }
  }
  const token = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(path.join(MEDIA_DIR, `${token}.jpg`), jpeg);
  return token;
}
const mediaPath = (token) => path.join(MEDIA_DIR, `${token}.jpg`);

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:20px;line-height:1.55;max-width:760px;margin-inline:auto}
  a{color:#58a6ff} h1{font-size:1.4rem} h2{font-size:1.08rem;margin-top:1.6em}
  img{max-width:100%;border-radius:12px} pre{white-space:pre-wrap;background:#161b22;padding:12px;border-radius:8px}
  .box{background:#161b22;border-radius:8px;padding:12px 14px;margin:10px 0} li{margin:4px 0}
  .btn{display:inline-block;background:#fe2c55;color:#fff;border:0;border-radius:8px;padding:11px 18px;font-size:1rem;text-decoration:none;cursor:pointer}
  .btn.sec{background:#30363d} .muted{color:#8b949e;font-size:.9rem} .ok{color:#3fb950} .bad{color:#f85149}
  input,select{background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:9px;font-size:1rem;width:100%;box-sizing:border-box;margin:4px 0 10px}
  input[type=checkbox],input[type=radio]{width:auto;margin-right:8px} label{display:block;margin:6px 0}
  footer{margin-top:36px;padding-top:14px;border-top:1px solid #30363d}
</style></head><body>${body}
<footer class="muted"><a href="/">Home</a> · <a href="/terms">Terms of Service</a> · <a href="/privacy">Privacy Policy</a></footer>
</body></html>`;
}

function homePage(req) {
  const labels = providerLabels();
  const ai = labels.length ? `enabled (${labels.join(', ')})` : 'disabled (gradient fallback)';
  const accounts = tiktok.listAccounts();
  const tk = tiktok.isConfigured()
    ? '<span class="ok">configured</span>'
    : '<span class="bad">not configured</span> — see <a href="/auth/tiktok/diagnostic">diagnostic</a>';
  const sess = parseCookies(req).tt_sess;
  const mine = accounts.filter((a) => tiktok.sessionOwns(a, sess));
  const mineHtml = mine
    .map(
      (a) => `<div class="box">Connected as <strong>${esc(a.displayName || a.openId)}</strong>
  <form method="post" action="/disconnect" style="margin-top:8px">
    <input type="hidden" name="account" value="${esc(a.openId)}">
    <button class="btn sec" type="submit">Disconnect</button>
  </form></div>`
    )
    .join('');

  return page(
    'Otaku Quote Automation',
    `<h1>Otaku Quote Automation</h1>
<p>Creates anime-inspired quote images with captions and publishes them as photo posts to a TikTok account
that the owner has connected and authorized.</p>
<div class="box">
  <div>Quotes: ${count('fr')} French, ${count('en')} English</div>
  <div>Image generation: ${esc(ai)}</div>
  <div>Writing styles ready: ${readyCount() + 1} of ${STYLES.length + 1}${fontsNote}</div>
  <div>TikTok connection: ${tk} · ${accounts.length} account(s) connected</div>
</div>
<h2>Connect TikTok</h2>
<p>Sign in with TikTok to authorize this application (Login Kit). We only request your basic profile
and permission to publish photo posts that you confirm.</p>
<p><a class="btn" href="/auth/tiktok">Connect with TikTok</a></p>
${mineHtml}
<h2>Publish a photo</h2>
<p>After connecting, review and publish a post: <a href="/publish">open the publishing page</a>.</p>
<h2>Posting schedule</h2>
<ul>${config.slots
      .map((s) => `<li>${esc(s.time)} (${esc(s.timezone)}) — ${esc(s.country)}, ${s.lang === 'fr' ? 'French' : 'English'} quote</li>`)
      .join('')}</ul>
<h2>Preview a post (nothing is published)</h2>
<ul>
  <li><a href="/preview?lang=fr">French example</a></li>
  <li><a href="/preview?lang=en">English example</a></li>
</ul>`
  );
}

function previewPage(q) {
  const caption = buildCaption(q);
  const style = pickStyle(q);
  return page(
    `Post preview #${q.id}`,
    `<h1>Post preview — nothing is published</h1>
<p><img src="/preview.jpg?id=${q.id}" alt="Post photo"></p>
<div class="box">
  <div>Quote #${q.id} (${q.lang === 'fr' ? 'French' : 'English'})</div>
  <div>${esc(q.character)} — ${esc(q.anime)} — theme: ${esc(q.theme)}</div>
  <div>Font: ${esc(style.family)}${style.builtin && readyCount() < STYLES.length ? ' (fallback font)' : ''}</div>
</div>
<h2>Title</h2><pre>${esc(caption.title)}</pre>
<h2>Description</h2><pre>${esc(caption.description)}</pre>
<h2>Image prompt</h2><pre>${esc(buildImagePrompt(q))}</pre>
<p><a href="/preview?lang=fr">Another French example</a> · <a href="/preview?lang=en">Another English example</a></p>`
  );
}

function messagePage(title, message, extra = '') {
  return page(title, `<h1>${esc(title)}</h1><div class="box">${message}</div>${extra}`);
}

function diagnosticPage(req) {
  const T = config.tiktok;
  const mask = (s) => (s.length > 4 ? `${s.slice(0, 2)}…${s.slice(-2)}` : s ? '••' : '');
  const keyOk = /^[A-Za-z0-9_-]+$/.test(T.clientKey);
  const redirectUri = tiktok.redirectUriFor(originOf(req));
  const row = (label, ok, detail) =>
    `<li><strong>${esc(label)}</strong> — <span class="${ok ? 'ok' : 'bad'}">${ok ? 'OK' : 'to check'}</span> ${detail ? `<span class="muted">${detail}</span>` : ''}</li>`;
  const trimmedKey = T.rawLengths.clientKey !== T.clientKey.length;
  const trimmedSecret = T.rawLengths.clientSecret !== T.clientSecret.length;
  return page(
    'TikTok diagnostic',
    `<h1>TikTok configuration diagnostic</h1>
<p class="muted">Nothing secret is shown here: the client key is masked and the secret is never displayed.</p>
<ul>
${row('TIKTOK_CLIENT_KEY present', Boolean(T.clientKey), T.clientKey ? `length ${T.clientKey.length}, starts/ends with “${esc(mask(T.clientKey))}”` : 'variable missing or empty')}
${row('Client key format (letters, digits, - _ only)', !T.clientKey || keyOk, keyOk ? '' : 'unexpected characters: check for a typo or a copied label')}
${row('No extra space or line break in the key', !trimmedKey, trimmedKey ? `the raw value was ${T.rawLengths.clientKey} characters, ${T.clientKey.length} after cleaning (cleaned automatically)` : '')}
${row('TIKTOK_CLIENT_SECRET present', Boolean(T.clientSecret), T.clientSecret ? `length ${T.clientSecret.length}${trimmedSecret ? ' (cleaned of extra spaces)' : ''}` : 'variable missing or empty')}
${row('Redirect URI', true, `<code>${esc(redirectUri)}</code> — must be listed exactly like this in the TikTok app (Login Kit, Web)`)}
${row('Scopes requested', Boolean(T.scopes), `<code>${esc(T.scopes)}</code> — each one must be enabled in the TikTok app`)}
${row('Admin password set (ADMIN_PASSWORD)', Boolean(T.adminPassword), 'required to publish')}
</ul>
<h2>Frequent cause of a “client_key” error</h2>
<p>An app that is not yet approved only works with its <strong>Sandbox</strong> credentials.
In the TikTok developer portal, open the <strong>Sandbox</strong> tab, add Login Kit, the redirect URI above and your test account
(Roles &amp; Access), then use the <strong>Sandbox</strong> client key and secret in the Railway variables.
The Production key stays inactive until the app is approved.</p>
<p><a class="btn sec" href="/">Back to home</a></p>`
  );
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------

let fontsNote = ' (downloading…)';

async function handleAuthStart(req, res) {
  if (!tiktok.isConfigured()) {
    return html(res, 500, messagePage('TikTok is not configured', 'The TikTok client key or secret is missing. Open the <a href="/auth/tiktok/diagnostic">diagnostic page</a>.'));
  }
  const state = crypto.randomBytes(16).toString('hex');
  const url = tiktok.buildAuthorizeUrl({ state, redirectUri: tiktok.redirectUriFor(originOf(req)) });
  return redirect(res, url, { 'Set-Cookie': cookie(req, 'tt_state', state, { path: '/auth/tiktok' }) });
}

async function handleAuthCallback(req, res, url) {
  const q = url.searchParams;
  const expected = parseCookies(req).tt_state;
  if (q.get('error')) {
    const detail = q.get('error_description') || q.get('error');
    return html(res, 400, messagePage('TikTok authorization was not completed', `${esc(detail)}`, '<p><a class="btn" href="/auth/tiktok">Try again</a></p>'));
  }
  if (!q.get('code') || !q.get('state') || !expected || q.get('state') !== expected) {
    return html(res, 400, messagePage('Invalid sign-in request', 'The sign-in session expired or does not match. Please start again.', '<p><a class="btn" href="/auth/tiktok">Connect with TikTok</a></p>'));
  }
  try {
    const tokens = await tiktok.exchangeCode(q.get('code'), tiktok.redirectUriFor(originOf(req)));
    let user = {};
    try {
      user = await tiktok.getUserInfo(tokens.access_token);
    } catch (err) {
      console.warn(`[tiktok] profil non lu (${err.message})`);
    }
    const sessionToken = crypto.randomBytes(24).toString('hex');
    const account = tiktok.saveAccount({ tokens, user, sessionToken });
    return html(
      res,
      200,
      messagePage(
        'TikTok account connected',
        `Connected as <strong>${esc(account.displayName || account.openId)}</strong>.<br><span class="muted">Permissions granted: ${esc(account.scope || '—')}</span>`,
        '<p><a class="btn" href="/publish">Continue to publishing</a> <a class="btn sec" href="/">Home</a></p>'
      ),
      { 'Set-Cookie': [cookie(req, 'tt_sess', sessionToken, { maxAge: 30 * 24 * 3600 }), cookie(req, 'tt_state', '', { path: '/auth/tiktok', maxAge: 0 })] }
    );
  } catch (err) {
    console.error(`[tiktok] échec de la connexion : ${err.message}`);
    return html(res, 502, messagePage('TikTok connection failed', esc(err.message), '<p><a class="btn sec" href="/auth/tiktok/diagnostic">Open the diagnostic</a></p>'));
  }
}

async function handlePublishPage(req, res, url) {
  const accounts = tiktok.listAccounts();
  if (!accounts.length) {
    return html(res, 200, messagePage('Publish a photo', 'No TikTok account is connected yet.', '<p><a class="btn" href="/auth/tiktok">Connect with TikTok</a></p>'));
  }
  const openId = url.searchParams.get('account');
  const account = accounts.find((a) => a.openId === openId) || accounts[0];
  const lang = url.searchParams.get('lang') === 'fr' ? 'fr' : 'en';

  let creator;
  try {
    creator = await tiktok.queryCreatorInfo(await tiktok.getAccessToken(account.openId));
  } catch (err) {
    return html(res, 502, messagePage('Could not load the TikTok creator information', esc(err.message), '<p><a class="btn sec" href="/">Home</a></p>'));
  }

  const quote = pickQuote(lang, { quotes, state: { used: [], recent: [] } }).quote;
  const caption = buildCaption(quote);
  const { jpeg } = await renderPost(quote, { useAI: aiAllowed() });
  const token = saveMedia(jpeg);
  const options = Array.isArray(creator.privacy_level_options) ? creator.privacy_level_options : [];
  const labels = {
    PUBLIC_TO_EVERYONE: 'Everyone',
    MUTUAL_FOLLOW_FRIENDS: 'Friends (mutual follows)',
    FOLLOWER_OF_CREATOR: 'Followers',
    SELF_ONLY: 'Only me',
  };

  return html(
    res,
    200,
    page(
      'Publish a photo',
      `<h1>Review and publish</h1>
<div class="box">Posting to TikTok account: <strong>${esc(creator.creator_nickname || account.displayName || account.openId)}</strong>
  ${creator.creator_username ? `<span class="muted">(@${esc(creator.creator_username)})</span>` : ''}</div>
<p><img src="/media/${token}.jpg" alt="Photo to publish"></p>
<h2>Title</h2><pre>${esc(caption.title)}</pre>
<h2>Description</h2><pre>${esc(caption.description)}</pre>
<p class="muted">Music is added automatically by TikTok. Content created by this application is original and not an official quote.</p>
<form method="post" action="/publish">
  <input type="hidden" name="token" value="${token}">
  <input type="hidden" name="quote" value="${quote.id}">
  <input type="hidden" name="account" value="${esc(account.openId)}">
  <label for="privacy">Who can view this post</label>
  <select id="privacy" name="privacy" required>
    <option value="">Select…</option>
    ${options.map((o) => `<option value="${esc(o)}">${esc(labels[o] || o)}</option>`).join('')}
  </select>
  <label><input type="checkbox" name="nocomment" value="1"${creator.comment_disabled ? ' checked disabled' : ''}> Disable comments</label>
  <label><input type="checkbox" name="consent" value="1" required> I confirm that I want to publish this photo to my TikTok account.</label>
  <label for="pw">Administrator password</label>
  <input id="pw" name="password" type="password" autocomplete="current-password" required>
  <button class="btn" type="submit">Publish to TikTok</button>
</form>
<p class="muted">Not what you want? <a href="/publish?lang=${lang}&account=${esc(account.openId)}">Generate another post</a>
 · <a href="/publish?lang=${lang === 'fr' ? 'en' : 'fr'}&account=${esc(account.openId)}">Switch to ${lang === 'fr' ? 'English' : 'French'} quotes</a></p>`
    )
  );
}

async function handlePublishPost(req, res) {
  const form = await readForm(req);
  if (!passwordOk(form.get('password'))) {
    return html(res, 403, messagePage('Wrong password', 'The administrator password is missing or incorrect. Nothing was published.', '<p><a class="btn sec" href="/publish">Back</a></p>'));
  }
  const token = String(form.get('token') || '');
  const quote = byId.get(String(form.get('quote')));
  const account = tiktok.getAccount(form.get('account'));
  if (!/^[a-f0-9]{32}$/.test(token) || !fs.existsSync(mediaPath(token)) || !quote || !account || !form.get('consent')) {
    return html(res, 400, messagePage('Invalid request', 'The post expired or the form is incomplete. Please generate a new post.', '<p><a class="btn" href="/publish">Back</a></p>'));
  }
  try {
    const accessToken = await tiktok.getAccessToken(account.openId);
    const creator = await tiktok.queryCreatorInfo(accessToken);
    const privacy = String(form.get('privacy') || '');
    if (!(creator.privacy_level_options || []).includes(privacy)) {
      return html(res, 400, messagePage('Choose who can view the post', 'Please select one of the visibility options offered by TikTok.', '<p><a class="btn" href="/publish">Back</a></p>'));
    }
    const caption = buildCaption(quote);
    const publishId = await tiktok.publishPhoto(accessToken, {
      title: caption.title,
      description: caption.description,
      privacyLevel: privacy,
      disableComment: Boolean(form.get('nocomment')) || Boolean(creator.comment_disabled),
      imageUrl: `${originOf(req)}/media/${token}.jpg`,
    });
    return html(
      res,
      200,
      messagePage(
        'Sent to TikTok',
        `The photo was submitted for publishing.<br><span class="muted">Publish ID: ${esc(publishId)}</span>`,
        `<p><a class="btn" href="/publish/status?account=${esc(account.openId)}&id=${encodeURIComponent(publishId)}">Check the status</a> <a class="btn sec" href="/">Home</a></p>
<p class="muted">Until the application passes TikTok's audit, posts made through the API are visible only to you (private).</p>`
      )
    );
  } catch (err) {
    console.error(`[tiktok] échec de la publication : ${err.message}`);
    return html(res, 502, messagePage('TikTok could not publish the photo', esc(err.message), '<p><a class="btn sec" href="/publish">Back</a></p>'));
  }
}

async function handlePublishStatus(req, res, url) {
  const account = tiktok.getAccount(url.searchParams.get('account'));
  const id = url.searchParams.get('id');
  if (!account || !id) return html(res, 400, messagePage('Invalid request', 'Missing account or publish ID.'));
  try {
    const st = await tiktok.fetchStatus(await tiktok.getAccessToken(account.openId), id);
    return html(
      res,
      200,
      messagePage('Publishing status', `Status: <strong>${esc(st.status || 'unknown')}</strong>${st.fail_reason ? `<br>Reason: ${esc(st.fail_reason)}` : ''}`, `<p><a class="btn" href="/publish/status?account=${esc(account.openId)}&id=${encodeURIComponent(id)}">Refresh</a> <a class="btn sec" href="/">Home</a></p>`)
    );
  } catch (err) {
    return html(res, 502, messagePage('Could not read the status', esc(err.message)));
  }
}

async function handleDisconnect(req, res) {
  const form = await readForm(req);
  const account = tiktok.getAccount(form.get('account'));
  const owner = tiktok.sessionOwns(account, parseCookies(req).tt_sess);
  if (!account || !(owner || passwordOk(form.get('password')))) {
    return html(res, 403, messagePage('Not allowed', 'Only the person who connected this account can disconnect it from this browser.', '<p><a class="btn sec" href="/">Home</a></p>'));
  }
  await tiktok.revokeToken(account.accessToken);
  tiktok.removeAccount(account.openId);
  return html(res, 200, messagePage('Disconnected', 'Your TikTok account was disconnected and the stored tokens were deleted.', '<p><a class="btn sec" href="/">Home</a></p>'));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    const get = req.method === 'GET' || req.method === 'HEAD';

    if (p === '/health') return send(res, 200, 'text/plain; charset=utf-8', 'ok');
    if (p === '/' && get) return html(res, 200, homePage(req));
    if (p === '/terms' && get) return html(res, 200, page('Terms of Service — Otaku Quote Automation', legal.termsBody));
    if (p === '/privacy' && get) return html(res, 200, page('Privacy Policy — Otaku Quote Automation', legal.privacyBody));

    if (p === '/auth/tiktok' && get) return handleAuthStart(req, res);
    if (p === '/auth/tiktok/callback' && get) return handleAuthCallback(req, res, url);
    if (p === '/auth/tiktok/diagnostic' && get) return html(res, 200, diagnosticPage(req));

    if (p === '/publish' && get) return handlePublishPage(req, res, url);
    if (p === '/publish' && req.method === 'POST') return handlePublishPost(req, res);
    if (p === '/publish/status' && get) return handlePublishStatus(req, res, url);
    if (p === '/disconnect' && req.method === 'POST') return handleDisconnect(req, res);

    const media = p.match(/^\/media\/([a-f0-9]{32})\.jpg$/);
    if (media && get && fs.existsSync(mediaPath(media[1]))) {
      return send(res, 200, 'image/jpeg', fs.readFileSync(mediaPath(media[1])), { 'Cache-Control': 'no-store' });
    }

    if (p === '/preview' && get) {
      const id = url.searchParams.get('id');
      let q = id ? byId.get(String(id)) : null;
      if (!q) {
        const lang = url.searchParams.get('lang') === 'fr' ? 'fr' : 'en';
        // état vide : un aperçu n'utilise ni ne modifie la liste des citations déjà postées
        q = pickQuote(lang, { quotes, state: { used: [], recent: [] } }).quote;
      }
      return html(res, 200, previewPage(q));
    }

    if (p === '/preview.jpg' && get) {
      const q = byId.get(String(url.searchParams.get('id')));
      if (!q) return send(res, 404, 'text/plain; charset=utf-8', 'Quote not found');
      const { jpeg, backgroundSource, style } = await renderPost(q, { useAI: aiAllowed() });
      return send(res, 200, 'image/jpeg', jpeg, {
        'Cache-Control': 'no-store',
        'X-Background-Source': backgroundSource,
        'X-Font': style.id,
      });
    }

    // Fichier de vérification TikTok : uniquement un nom du type tiktokXXXX.txt à la racine
    const m = p.match(/^\/(tiktok[A-Za-z0-9]+\.txt)$/);
    if (m) {
      const file = path.join(config.root, m[1]);
      if (fs.existsSync(file)) return send(res, 200, 'text/plain; charset=utf-8', fs.readFileSync(file));
    }

    return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  } catch (err) {
    console.error('[server]', err);
    return send(res, 500, 'text/plain; charset=utf-8', 'Internal error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Otaku Quote Bot en ligne sur le port ${PORT} (${count('fr')} FR / ${count('en')} EN)`);
  console.log(`[tiktok] ${tiktok.isConfigured() ? 'clés présentes' : 'clés absentes'} | scopes : ${config.tiktok.scopes} | publication ${config.tiktok.adminPassword ? 'protégée par mot de passe' : 'désactivée (ADMIN_PASSWORD absent)'}`);
  // Téléchargement des polices en arrière-plan : le serveur répond déjà, avec Poppins en secours
  ensureFonts().then(({ ready, total, failures }) => {
    fontsNote = '';
    console.log(`[polices] ${ready}/${total} styles prêts`);
    failures.forEach((f) => console.warn(`[polices] échec : ${f}`));
  });
});
