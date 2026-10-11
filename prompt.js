'use strict';

// Décor typique de chaque animé (le personnage est placé dedans)
const ANIME_SETTINGS = {
  'Attack on Titan': 'massive stone walls, gloomy fortified city, stormy sky',
  'Black Clover': 'magical kingdom, floating grimoire pages, swirling mana',
  Bleach: 'moonlit rooftops, swirling spiritual energy, Soul Society architecture',
  'Death Note': 'dark gothic atmosphere, a falling black feather, dramatic shadows',
  'Demon Slayer': 'Taisho-era Japan, bamboo forest, flowing water and flame breathing effects',
  'Dr. Stone': 'overgrown ruins, lush wilderness, a rustic science lab',
  'Dragon Ball': 'rocky wasteland, glowing energy aura, dramatic sky',
  'Fullmetal Alchemist': 'alchemical transmutation circles, steampunk town, golden light',
  'Haikyuu!!': 'school gymnasium, volleyball net, sunlight through high windows',
  'Hunter x Hunter': 'vast fantasy wilderness, mysterious ruins, adventurous horizon',
  'Jujutsu Kaisen': 'swirling cursed energy, dark city at night, ominous aura',
  'My Hero Academia': 'heroic city skyline, bright dramatic sky, sense of power',
  Naruto: 'hidden leaf village, cliffside, orange sunset, swirling chakra',
  'One Piece': 'open sea, pirate ship, bright adventure sky',
  'One-Punch Man': 'ruined city street, bold dramatic lighting, heroic atmosphere',
};

// Thème -> ambiance (pour l'image) et palette (pour le fond de secours)
// [ambiance, couleur haute, couleur basse, couleur d'accent]
const THEME_MOODS = {
  // français
  ambition: ['burning determination, rising light', '#7a2e0e', '#12060a', '#ffb347'],
  amitié: ['warm friendship, golden hour glow', '#a0522d', '#1a0f12', '#ffd27f'],
  amour: ['tender, romantic, soft pink glow', '#8e2a5b', '#150815', '#ff9ec4'],
  choix: ['a crossroads, tense and decisive mood', '#2c3e6b', '#0a0d1a', '#9ec1ff'],
  confiance: ['calm confidence, steady bright light', '#1f5a73', '#08121a', '#8fe3ff'],
  courage: ['fierce courage, dramatic red sky', '#8b1a1a', '#14070a', '#ff7a5c'],
  espoir: ['hopeful dawn, light breaking through clouds', '#2e6b8f', '#0c1424', '#ffe29a'],
  famille: ['warm and gentle, soft evening light', '#7d4a2b', '#160e10', '#ffc9a0'],
  humilité: ['quiet and humble, soft muted tones', '#4a5a6a', '#0d1117', '#d0dae6'],
  mentalité: ['focused mindset, cold determined light', '#1d3b5a', '#070d16', '#8ec8ff'],
  motivation: ['energetic, rising sun, intense light', '#9a3b0e', '#150a06', '#ffc04d'],
  'paix intérieure': ['serene, peaceful, calm water and soft light', '#2c6a6a', '#081416', '#a8f0e0'],
  respect: ['solemn and honorable, deep blue dusk', '#2a3a6a', '#090c18', '#b5c7ff'],
  résilience: ['standing up after the storm, breaking clouds', '#3b4a6b', '#0a0e18', '#ffd27f'],
  réussite: ['triumphant, golden victorious light', '#8a6a12', '#140f06', '#ffe27a'],
  rêves: ['dreamy night sky, stars and soft glow', '#3b2c7a', '#0a0818', '#c9b6ff'],
  sagesse: ['wise and contemplative, ancient mystical light', '#4a3a6b', '#0e0a18', '#e0c8ff'],
  solitude: ['lonely, melancholic, vast empty space, cold moonlight', '#1c2a4a', '#05070f', '#9fb4d8'],
  temps: ['passing time, soft light, falling petals or leaves', '#5a4a3a', '#120e0b', '#f0d9b5'],
  vérité: ['sharp clarity, stark contrast lighting', '#2a2a3a', '#07070c', '#e6e6ff'],
  // anglais
  determination: ['burning determination, intense dramatic light', '#8a2e10', '#140806', '#ffb347'],
  discipline: ['strict, focused, sharp morning light', '#244a5a', '#08121a', '#8fe0ff'],
  focus: ['intense focus, narrow beam of light', '#1d3b5a', '#070d16', '#8ec8ff'],
  friendship: ['warm friendship, golden hour glow', '#a0522d', '#1a0f12', '#ffd27f'],
  hope: ['hopeful dawn, light breaking through clouds', '#2e6b8f', '#0c1424', '#ffe29a'],
  leadership: ['commanding presence, epic wide sky', '#6a2a2a', '#120709', '#ffb08a'],
  loyalty: ['steadfast loyalty, deep blue and gold light', '#24366a', '#080b18', '#ffd27f'],
  overcoming_pain: ['rising above pain, storm clearing at dawn', '#4a2a4a', '#0e0710', '#ffb3c9'],
  patience: ['calm patience, still lake, soft light', '#2c5a5a', '#081214', '#b5f0e6'],
  personal_growth: ['growth and change, sprouting light, fresh dawn', '#2c6a4a', '#08140e', '#b8f5c8'],
  purpose: ['clear purpose, a path leading to a bright horizon', '#6a4a12', '#140e06', '#ffe08a'],
  resilience: ['standing up after the storm, breaking clouds', '#3b4a6b', '#0a0e18', '#ffd27f'],
  self_respect: ['dignified and proud, strong calm light', '#3a3a6b', '#0a0a18', '#d0c8ff'],
  // "ambition", "courage" et "solitude" existent dans les deux langues : une seule entrée suffit
};

const DEFAULT_MOOD = ['epic cinematic mood', '#2a2a5a', '#08080f', '#ffd27f'];

function moodFor(theme) {
  return THEME_MOODS[theme] || DEFAULT_MOOD;
}

function settingFor(anime) {
  return ANIME_SETTINGS[anime] || 'epic anime world';
}

/**
 * Consigne pour le modèle d'images : le personnage de la citation, dans l'univers
 * de son animé, avec de la place vide en bas pour écrire la citation.
 * (Le texte est ajouté ensuite par le programme : on demande donc une image sans texte.)
 */
function buildImagePrompt(q) {
  const [mood] = moodFor(q.theme);
  const setting = settingFor(q.anime);
  return [
    `Anime key visual of ${q.character} from the anime ${q.anime},`,
    `${setting},`,
    `${mood},`,
    'cinematic lighting, highly detailed, vibrant anime illustration,',
    'vertical 9:16 composition, the character in the upper half,',
    'empty dark space in the lower third,',
    'no text, no letters, no watermark, no logo',
  ].join(' ');
}

module.exports = { buildImagePrompt, moodFor, settingFor };
