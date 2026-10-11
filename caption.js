'use strict';

const TITLE_MAX = 90; // limite TikTok pour le titre d'un post photo

const BASE_TAGS = {
  en: ['anime', 'animequotes', 'otaku', 'fyp'],
  fr: ['anime', 'citationanime', 'otaku', 'pourtoi'],
};

// Hashtag du thème, dans la langue du post
const THEME_TAGS = {
  // français
  ambition: 'ambition',
  amitié: 'amitie',
  amour: 'amour',
  choix: 'choix',
  confiance: 'confiance',
  courage: 'courage',
  espoir: 'espoir',
  famille: 'famille',
  humilité: 'humilite',
  mentalité: 'mentalite',
  motivation: 'motivation',
  'paix intérieure': 'paixinterieure',
  respect: 'respect',
  résilience: 'resilience',
  réussite: 'reussite',
  rêves: 'reves',
  sagesse: 'sagesse',
  solitude: 'solitude',
  temps: 'temps',
  vérité: 'verite',
  // anglais
  determination: 'determination',
  discipline: 'discipline',
  focus: 'focus',
  friendship: 'friendship',
  hope: 'hope',
  leadership: 'leadership',
  loyalty: 'loyalty',
  overcoming_pain: 'overcomingpain',
  patience: 'patience',
  personal_growth: 'personalgrowth',
  purpose: 'purpose',
  resilience: 'resilience',
  self_respect: 'selfrespect',
};

function slug(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function truncate(text, max) {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`;
}

/**
 * Titre + description du post.
 * Les citations sont des phrases originales "à la manière" du personnage :
 * on écrit donc « inspiré de » plutôt que de les présenter comme de vraies répliques.
 */
function buildCaption(q) {
  const tags = [
    ...BASE_TAGS[q.lang],
    slug(q.anime),
    slug(q.character),
    THEME_TAGS[q.theme] || slug(q.theme),
  ];
  const hashtags = [...new Set(tags.filter(Boolean))].map((t) => `#${t}`);

  const credit =
    q.lang === 'fr'
      ? `— inspiré de ${q.character} (${q.anime})`
      : `— inspired by ${q.character} (${q.anime})`;

  const title = truncate(`${q.character} · ${q.anime}`, TITLE_MAX);
  const description = `${q.quote}\n\n${credit}\n\n${hashtags.join(' ')}`;

  return { title, description, hashtags };
}

module.exports = { buildCaption, slug };
