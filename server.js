'use strict';

/**
 * Petit serveur web pour Railway. Il reste allumé et expose :
 *   /               page d'état (langues, créneaux, Hugging Face activé ou non)
 *   /health         contrôle de santé ("ok")
 *   /preview        génère un post de test (photo + légende), SANS rien publier
 *   /preview.jpg    la photo seule (utilisée par /preview)
 *   /tiktok<...>.txt  fichier de vérification de propriété demandé par TikTok
 *                     (à déposer à la racine du dépôt, sans le modifier)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { loadQuotes, pickQuote } = require('./quotes');
const { buildCaption } = require('./caption');
const { buildImagePrompt } = require('./prompt');
const { renderPost, hasAiProvider, providerLabels } = require('./image');
const { ensureFonts, pickStyle, readyCount, STYLES } = require('./fonts');

const PORT = Number(process.env.PORT) || 3000;
const quotes = loadQuotes();
const byId = new Map(quotes.map((q) => [String(q.id), q]));
const count = (lang) => quotes.filter((q) => q.lang === lang).length;

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

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function send(res, status, type, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': type, ...headers });
  res.end(body);
}

function page(title, body) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:20px;line-height:1.5}
  a{color:#58a6ff} h1{font-size:1.3rem} h2{font-size:1.05rem;margin-top:1.6em}
  img{max-width:100%;border-radius:12px} pre{white-space:pre-wrap;background:#161b22;padding:12px;border-radius:8px}
  .box{background:#161b22;border-radius:8px;padding:12px 14px} li{margin:4px 0}
</style></head><body>${body}</body></html>`;
}

let fontsNote = ' (téléchargement en cours…)';

function statusPage() {
  const labels = providerLabels();
  const ai = labels.length ? `activée (${labels.join(', ')})` : 'désactivée (fond dégradé de secours)';
  return page(
    'Otaku Quote Bot',
    `<h1>Otaku Quote Bot — en ligne</h1>
<div class="box">
  <div>Citations : ${count('fr')} en français, ${count('en')} en anglais</div>
  <div>Génération d'images : ${esc(ai)}</div>
  <div>Styles d'écriture prêts : ${readyCount() + 1} sur ${STYLES.length + 1}${fontsNote}</div>
</div>
<h2>Créneaux prévus (3 par jour)</h2>
<ul>${config.slots
      .map((s) => `<li>${esc(s.time)} (${esc(s.timezone)}) — ${esc(s.country)}, citation ${s.lang === 'fr' ? 'française' : 'anglaise'}</li>`)
      .join('')}</ul>
<h2>Voir un post de test (rien n'est publié)</h2>
<ul>
  <li><a href="/preview?lang=fr">Exemple en français</a></li>
  <li><a href="/preview?lang=en">Exemple en anglais</a></li>
</ul>`
  );
}

function previewPage(q) {
  const caption = buildCaption(q);
  const style = pickStyle(q);
  return page(
    `Post de test #${q.id}`,
    `<h1>Post de test — rien n'est publié</h1>
<p><img src="/preview.jpg?id=${q.id}" alt="Photo du post"></p>
<div class="box">
  <div>Citation n°${q.id} (${q.lang === 'fr' ? 'français' : 'anglais'})</div>
  <div>${esc(q.character)} — ${esc(q.anime)} — thème : ${esc(q.theme)}</div>
  <div>Police : ${esc(style.family)}${style.builtin && readyCount() < STYLES.length ? ' (police de secours)' : ''}</div>
</div>
<h2>Titre</h2><pre>${esc(caption.title)}</pre>
<h2>Description</h2><pre>${esc(caption.description)}</pre>
<h2>Consigne envoyée au générateur d'images</h2><pre>${esc(buildImagePrompt(q))}</pre>
<p><a href="/preview?lang=fr">Autre exemple en français</a> · <a href="/preview?lang=en">Autre exemple en anglais</a> · <a href="/">Accueil</a></p>`
  );
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (p === '/health') return send(res, 200, 'text/plain; charset=utf-8', 'ok');
    if (p === '/') return send(res, 200, 'text/html; charset=utf-8', statusPage());

    if (p === '/preview') {
      const id = url.searchParams.get('id');
      let q = id ? byId.get(String(id)) : null;
      if (!q) {
        const lang = url.searchParams.get('lang') === 'fr' ? 'fr' : 'en';
        // état vide : un aperçu n'utilise ni ne modifie la liste des citations déjà postées
        q = pickQuote(lang, { quotes, state: { used: [], recent: [] } }).quote;
      }
      return send(res, 200, 'text/html; charset=utf-8', previewPage(q));
    }

    if (p === '/preview.jpg') {
      const q = byId.get(String(url.searchParams.get('id')));
      if (!q) return send(res, 404, 'text/plain; charset=utf-8', 'Citation introuvable');
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

    return send(res, 404, 'text/plain; charset=utf-8', 'Introuvable');
  } catch (err) {
    console.error('[server]', err);
    return send(res, 500, 'text/plain; charset=utf-8', 'Erreur interne');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Otaku Quote Bot en ligne sur le port ${PORT} (${count('fr')} FR / ${count('en')} EN)`);
  // Téléchargement des polices en arrière-plan : le serveur répond déjà, avec Poppins en secours
  ensureFonts().then(({ ready, total, failures }) => {
    fontsNote = '';
    console.log(`[polices] ${ready}/${total} styles prêts`);
    failures.forEach((f) => console.warn(`[polices] échec : ${f}`));
  });
});
