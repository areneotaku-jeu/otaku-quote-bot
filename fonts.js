'use strict';

/**
 * 25 styles d'écriture pour la citation :
 *  - 24 polices Google Fonts téléchargées au démarrage du serveur (Railway a accès à Internet)
 *  - Poppins Bold, fournie dans le dépôt, qui sert aussi de secours si un téléchargement échoue
 *
 * Le style est choisi selon l'ambiance du thème de la citation (épique, élégant, romantique, calme/triste)
 * et reste le même pour une même citation.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

// Poppins : fournie dans le dépôt, toujours disponible
const POPPINS = {
  id: 'poppins-bold',
  family: 'Poppins',
  pangoName: 'Poppins Bold',
  group: 'any',
  scale: 1,
  upper: false,
  builtin: true,
  file: config.paths.fontBold,
};

// scale : multiplie la taille de départ (polices étroites = plus grandes, polices larges = plus petites)
// weight : graisse demandée à Google Fonts (400 par défaut)
const STYLES = [
  // Épique / puissant
  { id: 'bebas-neue', family: 'Bebas Neue', group: 'epic', scale: 1.25, upper: true },
  { id: 'anton', family: 'Anton', group: 'epic', scale: 1.0, upper: true },
  { id: 'bangers', family: 'Bangers', group: 'epic', scale: 1.1 },
  { id: 'archivo-black', family: 'Archivo Black', group: 'epic', scale: 0.85 },
  { id: 'russo-one', family: 'Russo One', group: 'epic', scale: 0.9 },
  { id: 'black-ops-one', family: 'Black Ops One', group: 'epic', scale: 0.8, upper: true },
  // Élégant / sage
  { id: 'cinzel', family: 'Cinzel', group: 'elegant', weight: 700, scale: 0.85 },
  { id: 'playfair-display', family: 'Playfair Display', group: 'elegant', weight: 700, scale: 0.95 },
  { id: 'cormorant-garamond', family: 'Cormorant Garamond', group: 'elegant', weight: 700, scale: 1.15 },
  { id: 'marcellus', family: 'Marcellus', group: 'elegant', scale: 1.0 },
  { id: 'lora', family: 'Lora', group: 'elegant', weight: 700, scale: 0.95 },
  { id: 'eb-garamond', family: 'EB Garamond', group: 'elegant', weight: 700, scale: 1.1 },
  // Romantique / doux
  { id: 'dancing-script', family: 'Dancing Script', group: 'romantic', weight: 700, scale: 1.15 },
  { id: 'pacifico', family: 'Pacifico', group: 'romantic', scale: 0.85 },
  { id: 'satisfy', family: 'Satisfy', group: 'romantic', scale: 1.2 },
  { id: 'caveat', family: 'Caveat', group: 'romantic', weight: 700, scale: 1.3 },
  { id: 'quicksand', family: 'Quicksand', group: 'romantic', weight: 700, scale: 1.0 },
  { id: 'comfortaa', family: 'Comfortaa', group: 'romantic', weight: 700, scale: 0.85 },
  // Calme / mélancolique / dramatique
  { id: 'amatic-sc', family: 'Amatic SC', group: 'calm', weight: 700, scale: 1.5, upper: true },
  { id: 'josefin-sans', family: 'Josefin Sans', group: 'calm', weight: 700, scale: 1.0 },
  { id: 'kalam', family: 'Kalam', group: 'calm', weight: 700, scale: 1.0 },
  { id: 'shadows-into-light', family: 'Shadows Into Light', group: 'calm', scale: 1.3 },
  { id: 'special-elite', family: 'Special Elite', group: 'calm', scale: 0.85 },
  { id: 'permanent-marker', family: 'Permanent Marker', group: 'calm', scale: 0.85 },
].map((s) => ({
  weight: 400,
  upper: false,
  ...s,
  // Nom de police transmis à Pango (le moteur de texte de sharp)
  pangoName: s.weight && s.weight >= 700 ? `${s.family} Bold` : s.family,
  file: null, // renseigné quand la police est téléchargée
}));

// Thème -> ambiance
const THEME_GROUPS = {
  // épique
  ambition: 'epic', courage: 'epic', motivation: 'epic', mentalité: 'epic', réussite: 'epic',
  determination: 'epic', discipline: 'epic', focus: 'epic', leadership: 'epic',
  // élégant
  sagesse: 'elegant', respect: 'elegant', vérité: 'elegant', choix: 'elegant', confiance: 'elegant',
  loyalty: 'elegant', self_respect: 'elegant', purpose: 'elegant',
  // romantique
  amour: 'romantic', amitié: 'romantic', famille: 'romantic', rêves: 'romantic', espoir: 'romantic',
  friendship: 'romantic', hope: 'romantic',
  // calme / mélancolique
  solitude: 'calm', temps: 'calm', humilité: 'calm', 'paix intérieure': 'calm', résilience: 'calm',
  patience: 'calm', overcoming_pain: 'calm', personal_growth: 'calm', resilience: 'calm',
};

// Agent utilisateur ancien : Google Fonts renvoie alors du TrueType (.ttf) et non du WOFF2,
// seul format que le moteur de texte de sharp sait lire.
const USER_AGENT = 'Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1';

function looksLikeFont(buf) {
  if (!buf || buf.length < 1000) return false;
  const tag = buf.subarray(0, 4);
  return (
    tag.equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) || // TrueType
    tag.toString('latin1') === 'OTTO' || // OpenType/CFF
    tag.toString('latin1') === 'true'
  );
}

function isValidFontFile(file) {
  try {
    return looksLikeFont(fs.readFileSync(file));
  } catch {
    return false;
  }
}

/** Dans la feuille de style de Google, repère l'adresse du fichier de police (sous-ensemble "latin" si découpé). */
function pickFontUrl(css) {
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{[^}]*?url\((['"]?)(https?:[^)'"]+)\2\)/g)];
  const latin = blocks.find((m) => m[1] === 'latin');
  if (latin) return latin[3];
  const any = css.match(/url\((['"]?)(https?:[^)'"]+)\1\)/);
  return any ? any[2] : null;
}

async function fetchChecked(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(config.fonts.timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function downloadStyle(style) {
  const dest = path.join(config.paths.fontsDir, `${style.id}.ttf`);
  if (isValidFontFile(dest)) {
    style.file = dest;
    return;
  }
  const familyParam = encodeURIComponent(style.family).replace(/%20/g, '+');
  const axis = style.weight !== 400 ? `:wght@${style.weight}` : '';
  const css = await (await fetchChecked(`${config.fonts.cssUrl}?family=${familyParam}${axis}`)).text();
  const fontUrl = pickFontUrl(css);
  if (!fontUrl) throw new Error('adresse de police introuvable');
  const buf = Buffer.from(await (await fetchChecked(fontUrl)).arrayBuffer());
  if (!looksLikeFont(buf)) throw new Error('format non pris en charge (TrueType attendu)');
  fs.mkdirSync(config.paths.fontsDir, { recursive: true });
  fs.writeFileSync(`${dest}.tmp`, buf);
  fs.renameSync(`${dest}.tmp`, dest);
  style.file = dest;
}

/** Télécharge les polices manquantes (6 à la fois). Ne lève jamais d'erreur : Poppins sert de secours. */
async function ensureFonts() {
  if (!config.fonts.enabled) return summary([]);
  const failures = [];
  const queue = [...STYLES];
  const worker = async () => {
    while (queue.length) {
      const style = queue.shift();
      try {
        await downloadStyle(style);
      } catch (err) {
        failures.push(`${style.family} (${err.message})`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return summary(failures);
}

function readyCount() {
  return STYLES.filter((s) => s.file).length;
}

function summary(failures) {
  return { ready: readyCount() + 1, total: STYLES.length + 1, failures }; // +1 : Poppins
}

function hash(n) {
  return Math.imul(Number(n) || 0, 2654435761) >>> 0;
}

/**
 * Style d'écriture d'une citation : selon l'ambiance de son thème, toujours le même pour une même citation.
 * `avoid` : identifiants de styles récents à éviter si possible. `forceId` : imposer un style (tests).
 */
function pickStyle(quote, { avoid = [], forceId } = {}) {
  if (forceId) {
    const forced = STYLES.find((s) => s.id === forceId && s.file);
    return forced || POPPINS;
  }
  const group = THEME_GROUPS[quote.theme];
  const ready = STYLES.filter((s) => s.file && (!group || s.group === group));
  const pool = [...ready, POPPINS];
  const preferred = pool.filter((s) => !avoid.includes(s.id));
  const choices = preferred.length ? preferred : pool;
  return choices[hash(quote.id) % choices.length];
}

module.exports = { STYLES, POPPINS, ensureFonts, pickStyle, pickFontUrl, looksLikeFont, readyCount, summary };
