'use strict';

const sharp = require('sharp');
const config = require('./config');
const { buildImagePrompt, moodFor } = require('./prompt');

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

/** Fond généré par Hugging Face (nécessite HF_TOKEN et HF_IMAGE_ENABLED=true). */
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
  const buffer = Buffer.from(await result.arrayBuffer());
  return sharp(buffer).resize(W, H, { fit: 'cover', position: 'attention' }).png().toBuffer();
}

async function getBackground(q, { useHF = true } = {}) {
  if (useHF && config.hf.enabled && config.hf.token) {
    try {
      return { buffer: await huggingFaceBackground(q), source: 'huggingface' };
    } catch (err) {
      console.warn(`[image] Hugging Face a échoué (${err.message}), fond de secours utilisé.`);
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
async function renderQuote(text) {
  const maxHeight = 640;
  for (let size = 68; size >= 36; size -= 4) {
    const out = await renderText(text, {
      fontFile: config.paths.fontBold,
      fontName: 'Poppins Bold',
      size,
      color: '#ffffff',
      width: TEXT_WIDTH,
      spacing: 8,
    });
    if (out.info.height <= maxHeight) return out;
  }
  return renderText(text, {
    fontFile: config.paths.fontBold,
    fontName: 'Poppins Bold',
    size: 36,
    color: '#ffffff',
    width: TEXT_WIDTH,
    spacing: 6,
  });
}

// Poppins n'a pas d'emojis : sur le serveur ils s'afficheraient comme des carrés vides.
// On les retire de l'image (ils restent dans la description TikTok).
function stripEmoji(text) {
  return text
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function quoted(text, lang) {
  const clean = stripEmoji(text);
  return lang === 'fr' ? `« ${clean} »` : `“${clean}”`;
}

/**
 * Compose la photo finale : fond + voile sombre + citation + personnage / animé.
 * Retourne { jpeg, backgroundSource }.
 */
async function renderPost(q, { useHF = true } = {}) {
  const { buffer: bg, source } = await getBackground(q, { useHF });
  const [, , , accent] = moodFor(q.theme);

  const quote = await renderQuote(quoted(q.quote, q.lang));
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

  return { jpeg, backgroundSource: source };
}

module.exports = { renderPost, getBackground, fallbackBackground };
