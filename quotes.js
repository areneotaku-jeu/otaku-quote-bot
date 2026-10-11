'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

// Le fichier contient deux écritures du même animé
const ANIME_ALIASES = { 'One Punch Man': 'One-Punch Man' };

const RECENT_KEPT = 50;

function loadQuotes() {
  const raw = JSON.parse(fs.readFileSync(config.paths.quotes, 'utf8'));
  return raw.map((q) => ({
    id: q.id,
    character: String(q.character).trim(),
    anime: ANIME_ALIASES[q.anime] || String(q.anime).trim(),
    quote: String(q.quote).trim(),
    theme: q.theme,
    lang: q.type === 'original_english' ? 'en' : 'fr',
  }));
}

function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(config.paths.state, 'utf8'));
    return { used: s.used || [], recent: s.recent || [] };
  } catch {
    return { used: [], recent: [] };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(config.paths.state), { recursive: true });
  const tmp = `${config.paths.state}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, config.paths.state);
}

function lastValues(recent, key, n) {
  return new Set(recent.slice(-n).map((r) => r[key]));
}

/**
 * Tire une citation au hasard dans la langue demandée.
 * - jamais une citation déjà postée (tant qu'il en reste dans cette langue)
 * - évite de répéter l'animé, le personnage et le thème des posts récents
 */
function pickQuote(lang, { quotes = loadQuotes(), state = readState(), random = Math.random } = {}) {
  const used = new Set(state.used);
  const ofLang = quotes.filter((q) => q.lang === lang);
  if (!ofLang.length) throw new Error(`Aucune citation pour la langue "${lang}"`);

  let pool = ofLang.filter((q) => !used.has(q.id));
  let cycleReset = false;
  if (!pool.length) {
    pool = ofLang; // tout a été posté : nouveau cycle
    cycleReset = true;
  }

  const r = state.recent;
  const rules = [
    (q) =>
      !lastValues(r, 'anime', 3).has(q.anime) &&
      !lastValues(r, 'character', 3).has(q.character) &&
      !lastValues(r, 'theme', 2).has(q.theme),
    (q) => !lastValues(r, 'anime', 2).has(q.anime),
    (q) => !lastValues(r, 'anime', 1).has(q.anime),
    () => true,
  ];

  let candidates = pool;
  for (const rule of rules) {
    const filtered = pool.filter(rule);
    if (filtered.length) {
      candidates = filtered;
      break;
    }
  }

  const quote = candidates[Math.floor(random() * candidates.length)];
  return { quote, cycleReset };
}

/** À appeler seulement quand le post est réellement parti. */
function markPosted(quote, { cycleReset = false } = {}) {
  const state = readState();
  if (cycleReset) {
    const sameLang = new Set(loadQuotes().filter((q) => q.lang === quote.lang).map((q) => q.id));
    state.used = state.used.filter((id) => !sameLang.has(id));
  }
  state.used.push(quote.id);
  state.recent.push({
    id: quote.id,
    anime: quote.anime,
    character: quote.character,
    theme: quote.theme,
    lang: quote.lang,
    at: new Date().toISOString(),
  });
  state.recent = state.recent.slice(-RECENT_KEPT);
  writeState(state);
}

module.exports = { loadQuotes, readState, pickQuote, markPosted };
