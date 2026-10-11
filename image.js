'use strict';

const sharp = require('sharp');
const config = require('./config');
const { buildImagePrompt, moodFor } = require('./prompt');
const { pickStyle } = require('./fonts');

const { width: W, height: H } = config;

// TikTok superpose son interface en bas et sur le côté droit : on garde une zone sûre.
const TEXT_WIDTH = 880;
const TEXT_BOTTOM = 1480; // le texte ne descend jamais plus bas
const TEXT_TOP_MIN = 880; // ni plus haut (le personnage reste visible en haut)

function escapeMarkup(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Fond de secours : dégradé aux couleurs du thème + halo lumineux. */
async function fallbackBackground(q) {
  const [, top, bottom, accent] = moodFor(q.theme);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${top}"/>
          <stop offset="1" stop-color="${bottom}"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.32" r="0.45">
          <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
          <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Adapte une image générée au format TikTok 9:16.
 * - déjà en 9:16 (à 5 % près) : recadrage plein cadre ;
 * - sinon (ex. image carrée de Cloudflare) : l'image est placée en haut, à la pleine largeur,
 *   sur une version floutée et assombrie d'elle-même qui remplit le reste de l'écran.
 */
async function toPortrait(buffer) {
  const meta = await sharp(buffer).metadata();
  const ratio = meta.width / meta.height;
  const target = W / H;
  if (Math.abs(ratio - target) / target < 0.05) {
    return sharp(buffer).resize(W, H, { fit: 'cover' }).png().toBuffer();
  }
  const blurred = await sharp(buffer)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .blur(40)
    .modulate({ brightness: 0.55 })
    .png()
    .toBuffer();
  const resized = await sharp(buffer).resize({ width: W }).png().toBuffer();
  const mainMeta = await sharp(resized).metadata();
  // Les bords haut et bas de l'image se fondent dans le fond flouté (pas de coupure nette)
  const fade = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${mainMeta.width}" height="${mainMeta.height}">
      <defs>
        <linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0"/>
          <stop offset="0.10" stop-color="#fff" stop-opacity="1"/>
          <stop offset="0.62" stop-color="#fff" stop-opacity="1"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#f)"/>
    </svg>`);
  const main = await sharp(resized).composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer();
  const top = Math.max(0, Math.round((H - mainMeta.height) * 0.12));
  return sharp(blurred).composite([{ input: main, top, left: 0 }]).png().toBuffer();
}

/** Fond généré par Cloudflare Workers AI (FLUX.1 schnell) : gratuit dans la limite quotidienne. */
async function cloudflareBackground(q) {
  const { accountId, token, model, steps, baseUrl, timeoutMs } = config.cloudflare;
  const res = await fetch(`${baseUrl}/accounts/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildImagePrompt(q), steps }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const detail = data.errors && data.errors[0] ? data.errors[0].message : '';
    throw new Error(`HTTP ${res.status}${detail ? ` : ${detail}` : ''}`);
  }
  const b64 = (data.result && data.result.image) || data.image;
  if (typeof b64 !== 'string' || !b64) throw new Error('aucune image dans la réponse');
  return toPortrait(Buffer.from(b64, 'base64'));
}

/** Fond généré par Hugging Face (nécessite HF_TOKEN et HF_IMAGE_ENABLED=true ; crédits d'inférence requis). */
async function huggingFaceBackground(q) {
  const { InferenceClient } = await import('@huggingface/inference');
  const client = new InferenceClient(config.hf.token);
  const result = await client.textToImage(
    {
      model: config.hf.model,
      inputs: buildImagePrompt(q),
      parameters: { width: config.hf.width, height: config.hf.height },
    },
    { outputType: 'blob' }
  );
  return toPortrait(Buffer.from(await result.arrayBuffer()));
}

// Générateurs d'images disponibles, essayés dans l'ordre de IMAGE_PROVIDERS (défaut : cloudflare, puis huggingface)
const PROVIDERS = {
  cloudflare: {
    label: 'Cloudflare',
    available: () => Boolean(config.cloudflare.token && config.cloudflare.accountId),
    run: cloudflareBackground,
  },
  huggingface: {
    label: 'Hugging Face',
    available: () => Boolean(config.hf.enabled && config.hf.token),
    run: huggingFaceBackground,
  },
};

function activeProviders() {
  return config.imageProviders.filter((name) => PROVIDERS[name] && PROVIDERS[name].available());
}

/** Noms lisibles des générateurs configurés (pour la page d'état). */
function providerLabels() {
  return activeProviders().map((name) => PROVIDERS[name].label);
}

function hasAiProvider() {
  return activeProviders().length > 0;
}

async function getBackground(q, { useAI = true } = {}) {
  if (useAI) {
    for (const name of activeProviders()) {
      try {
        return { buffer: await PROVIDERS[name].run(q), source: name };
      } catch (err) {
        console.warn(`[image] ${PROVIDERS[name].label} a échoué (${err.message}).`);
      }
    }
  }
  return { buffer: await fallbackBackground(q), source: 'fallback' };
}

/** Rend un texte avec la police Poppins fournie dans le dépôt (aucune police système requise). */
async function renderText(text, { fontFile, fontName, size, color, width, spacing = 0 }) {
  return sharp({
    text: {
      text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
      font: `${fontName} ${size}`,
      fontfile: fontFile,
      width,
      align: 'center',
      rgba: true,
      spacing,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
}

/** Réduit la taille de police jusqu'à ce que la citation tienne dans la hauteur disponible. */
async function renderQuote(text, style) {
  const maxHeight = 640;
  const start = Math.round(68 * style.scale);
  const min = Math.round(36 * style.scale);
  const render = (size) =>
    renderText(text, {
      fontFile: style.file,
      fontName: style.pangoName,
      size,
      color: '#ffffff',
      width: TEXT_WIDTH,
      spacing: Math.round(size / 8),
    });
  for (let size = start; size > min; size -= 4) {
    const out = await render(size);
    if (out.info.height <= maxHeight) return out;
  }
  return render(min);
}

// Poppins n'a pas d'emojis : sur le serveur ils s'afficheraient comme des carrés vides.
// On les retire de l'image (ils restent dans la description TikTok).
function stripEmoji(text) {
  return text
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function quoted(text, lang, style) {
  let clean = stripEmoji(text);
  if (style.upper) clean = clean.toLocaleUpperCase(lang === 'fr' ? 'fr' : 'en');
  return lang === 'fr' ? `« ${clean} »` : `“${clean}”`;
}

/**
 * Compose la photo finale : fond + voile sombre + citation + personnage / animé.
 * Retourne { jpeg, backgroundSource, style }.
 */
async function renderPost(q, { useAI = true, styleId, avoidStyles } = {}) {
  const { buffer: bg, source } = await getBackground(q, { useAI });
  const [, , , accent] = moodFor(q.theme);

  const style = pickStyle(q, { forceId: styleId, avoid: avoidStyles });
  const quote = await renderQuote(quoted(q.quote, q.lang, style), style);
  const who = await renderText(`— ${q.character}`, {
    fontFile: config.paths.fontBold,
    fontName: 'Poppins Bold',
    size: 46,
    color: accent,
    width: TEXT_WIDTH,
  });
  const anime = await renderText(q.anime, {
    fontFile: config.paths.fontMedium,
    fontName: 'Poppins Medium',
    size: 34,
    color: '#d8d8d8',
    width: TEXT_WIDTH,
  });

  const gap1 = 56;
  const gap2 = 14;
  const total = quote.info.height + gap1 + who.info.height + gap2 + anime.info.height;
  const startY = Math.max(TEXT_TOP_MIN, Math.round(TEXT_BOTTOM - total));

  const centerX = (img) => Math.round((W - img.info.width) / 2);
  const qY = startY;
  const wY = qY + quote.info.height + gap1;
  const aY = wY + who.info.height + gap2;

  // Voile dégradé pour garder le texte lisible sur n'importe quel fond
  const shadeTop = Math.max(0, startY - 380);
  const shade = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity="0"/>
          <stop offset="0.55" stop-color="#000" stop-opacity="0.62"/>
          <stop offset="1" stop-color="#000" stop-opacity="0.82"/>
        </linearGradient>
      </defs>
      <rect y="${shadeTop}" width="${W}" height="${H - shadeTop}" fill="url(#s)"/>
    </svg>`);

  const jpeg = await sharp(bg)
    .composite([
      { input: shade, top: 0, left: 0 },
      { input: quote.data, top: qY, left: centerX(quote) },
      { input: who.data, top: wY, left: centerX(who) },
      { input: anime.data, top: aY, left: centerX(anime) },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  return { jpeg, backgroundSource: source, style: { id: style.id, family: style.family, fallback: !!style.builtin } };
}

module.exports = { renderPost, getBackground, fallbackBackground, hasAiProvider, providerLabels };
