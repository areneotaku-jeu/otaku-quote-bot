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

// ---------------------------------------------------------------------------
// Fiches visuelles : le modèle d'images ne connaît pas bien les personnages à partir de leur seul nom.
// On lui décrit donc leurs traits distinctifs (cheveux, yeux, tenue, objets), en premier dans la consigne.
// ---------------------------------------------------------------------------

// Variantes de noms présentes dans quotes.json -> nom complet (par animé)
const ALIASES = {
  'Attack on Titan': { eren: 'Eren Yeager', levi: 'Levi Ackerman', mikasa: 'Mikasa Ackerman' },
  Bleach: {},
  'Death Note': { light: 'Light Yagami' },
  'Demon Slayer': { nezuko: 'Nezuko Kamado', rengoku: 'Kyojuro Rengoku', tanjiro: 'Tanjiro Kamado' },
  'Dr. Stone': { senku: 'Senku Ishigami' },
  'Dragon Ball': { 'son goku': 'Goku' },
  'Fullmetal Alchemist': { edward: 'Edward Elric' },
  'Haikyuu!!': { hinata: 'Shoyo Hinata', kenma: 'Kenma Kozume' },
  'Hunter x Hunter': { gon: 'Gon Freecss', killua: 'Killua Zoldyck' },
  'Jujutsu Kaisen': {
    gojo: 'Satoru Gojo',
    'gojo satoru': 'Satoru Gojo',
    megumi: 'Megumi Fushiguro',
    yuji: 'Yuji Itadori',
  },
  'My Hero Academia': { shoto: 'Shoto Todoroki' },
  Naruto: {
    itachi: 'Itachi Uchiha',
    kakashi: 'Kakashi Hatake',
    naruto: 'Naruto Uzumaki',
    sasuke: 'Sasuke Uchiha',
  },
  'One Piece': { luffy: 'Monkey D. Luffy', zoro: 'Roronoa Zoro' },
};

const CHARACTERS = {
  'Attack on Titan': {
    'Armin Arlert': 'a slender young man with short straight blond hair parted to the side, large blue eyes, gentle thoughtful expression, brown Survey Corps jacket with the Wings of Freedom emblem, white trousers, 3D maneuver gear straps',
    'Eren Yeager': 'a young man with messy dark brown hair, intense teal-green eyes, fierce determined expression, brown Survey Corps jacket with the Wings of Freedom emblem, 3D maneuver gear straps',
    'Levi Ackerman': 'a short lean man with short straight black hair with shaved undercut sides, narrow grey eyes, stern tired expression, green Survey Corps cloak with the Wings of Freedom emblem, white cravat at the neck, 3D maneuver gear straps',
    'Mikasa Ackerman': 'a young woman with short straight black hair, dark grey eyes, calm serious expression, a long red scarf, brown Survey Corps jacket with the Wings of Freedom emblem, 3D maneuver gear straps',
  },
  'Black Clover': {
    Asta: 'a muscular teenage boy with short spiky ash-blond hair, bright green eyes, wide determined grin, black sleeveless robe, holding a huge black anti-magic sword',
  },
  Bleach: {
    'Ichigo Kurosaki': 'a teenage boy with spiky bright orange hair, brown eyes, intense scowling expression, black shinigami kimono, a giant cleaver-like sword on his back',
    'Rukia Kuchiki': 'a petite young woman with short black hair and one long strand of hair between her eyes, large violet eyes, calm dignified expression, black shinigami kimono',
  },
  'Death Note': {
    L: 'a thin pale young man with messy black hair, dark circles under wide dark eyes, hunched posture, plain white long-sleeved shirt and blue jeans',
    'Light Yagami': 'a handsome young man with neat medium-length light brown hair, amber eyes, calm confident smile, white dress shirt and dark trousers',
  },
  'Demon Slayer': {
    'Giyu Tomioka': 'a calm young man with long black hair tied in a low ponytail, deep blue eyes, stoic expression, black Demon Slayer uniform with a two-pattern haori, katana',
    'Nezuko Kamado': 'a young girl with long black hair fading to orange tips, pink eyes with slit pupils, a bamboo muzzle in her mouth, pink kimono with a hemp-leaf pattern',
    'Kyojuro Rengoku': 'a tall muscular man with spiky blond hair with red tips and flame-shaped forked eyebrows, golden-red eyes, white flame-patterned haori over a Demon Slayer uniform, holding a flame-guard katana',
    'Tanjiro Kamado': 'a teenage boy with short messy dark maroon hair, a scar on his forehead, large red-brown eyes, green and black checkered haori, hanafuda earrings, black uniform, katana',
    'Zenitsu Agatsuma': 'a teenage boy with bright yellow hair with orange tips, nervous expression, yellow haori with a triangle pattern over a black uniform, katana',
  },
  'Dr. Stone': {
    'Senku Ishigami': 'a lean young man with tall spiky light-green hair fading to white, sharp red eyes, wide confident grin, simple handmade stone-age clothes',
  },
  'Dragon Ball': {
    Gohan: 'a young man with short black hair, gentle determined expression, purple and orange martial arts gi, glowing energy aura',
    Goku: 'a muscular man with wild spiky black hair, black eyes, confident grin, orange martial arts gi with a blue undershirt and wristbands, glowing energy aura',
    Piccolo: 'a tall muscular green-skinned alien warrior with pointed ears and antennae, white turban and white cape over a purple gi, stern expression',
    Vegeta: 'a short muscular man with tall upright flame-shaped black hair and a widow\'s peak, black eyes, arrogant smirk, blue Saiyan battle suit with white armor, white gloves and boots',
  },
  'Fullmetal Alchemist': {
    'Edward Elric': 'a short young man with long golden-blond hair in a braid, golden eyes, long red coat with a black cross emblem on the back, black outfit, a metal automail right arm',
    'Riza Hawkeye': 'a calm woman with blond hair clipped up in a tight bun with side bangs, dark brown eyes, blue military uniform, serious expression',
  },
  'Haikyuu!!': {
    'Shoyo Hinata': 'a short energetic boy with bright messy orange hair, big brown eyes, determined grin, orange and black volleyball jersey number 10',
    'Kenma Kozume': 'a slim boy with shoulder-length blond hair with dark roots, cat-like golden eyes, calm hunched posture, red volleyball jersey, a handheld game console in his hands',
  },
  'Hunter x Hunter': {
    'Gon Freecss': 'a cheerful boy with short spiky black hair, large brown eyes, bright smile, green jacket and green shorts, a fishing rod',
    'Killua Zoldyck': 'a lean boy with messy spiky silver-white hair, large blue eyes, cat-like smirk, dark casual outfit, crackling blue lightning around him',
  },
  'Jujutsu Kaisen': {
    'Satoru Gojo': 'a tall man with spiky snow-white hair, a black blindfold over his eyes, black high-collared Jujutsu High uniform, playful smirk',
    'Megumi Fushiguro': 'a teenage boy with spiky messy black hair, dark teal eyes, serious expression, black high-collared Jujutsu High uniform',
    'Nobara Kugisaki': 'a teenage girl with a short orange-brown bob haircut, brown eyes, confident smirk, black Jujutsu High uniform, holding a hammer and nails',
    'Yuji Itadori': 'a muscular teenage boy with short spiky pink-brown hair, orange-brown eyes, cheerful determined expression, black Jujutsu High uniform with a red hood',
  },
  'My Hero Academia': {
    'All Might': 'a gigantic extremely muscular blond man with two tall upright locks of hair, blue eyes, huge confident smile, blue white and red hero costume with yellow gloves',
    'Izuku Midoriya': 'a boy with messy dark green curly hair, green eyes, freckles, determined expression, green hero suit with a mouth guard and red boots',
    'Shoto Todoroki': 'a teenage boy with half-white and half-red split hair, one grey eye and one turquoise eye, a burn scar around his left eye, calm cold expression, ice on his right side and flames on his left',
  },
  Naruto: {
    'Hinata Hyuga': 'a shy young woman with long dark blue-indigo hair with straight bangs, pale lavender eyes, gentle expression, Konoha ninja headband and a lavender-white jacket',
    'Itachi Uchiha': 'a calm man with long black hair tied in a low ponytail, long tear-trough lines under his eyes, red Sharingan eyes, black cloak with red clouds, a scratched Konoha headband',
    'Kakashi Hatake': 'a tall man with spiky silver-white hair, a face mask covering his nose and mouth, a Konoha headband covering his left eye, relaxed expression, green flak vest over dark clothes',
    'Naruto Uzumaki': 'a teenage boy with spiky bright blond hair, bright blue eyes, three whisker marks on each cheek, big grin, orange and black jumpsuit, Konoha headband',
    'Sasuke Uchiha': 'a teenage boy with spiky black hair and long front bangs, dark eyes, cold expression, high-collared dark blue shirt, white shorts, katana',
    'Shikamaru Nara': 'a lanky teenage boy with black hair tied in a high spiky ponytail, dark lazy eyes, bored expression, green Konoha flak vest, ninja headband',
  },
  'One Piece': {
    'Monkey D. Luffy': 'a lean cheerful young man with messy black hair, a small scar under his left eye, huge toothy grin, a straw hat with a red band, red open vest, blue shorts, sandals',
    Nami: 'a young woman with long bright orange hair, brown eyes, cheerful smirk, bright casual top and jeans, holding a long wooden staff',
    'Roronoa Zoro': 'a muscular young man with short green hair, a scar over his left eye, three gold earrings on his left ear, green sash at the waist, three katana, fierce expression',
    Sanji: 'a tall lean man with blond hair swept over his left eye, a curly eyebrow, a cigarette in his mouth, black suit with a white shirt and thin black tie',
  },
  'One-Punch Man': {
    Saitama: 'a bald muscular man with a plain deadpan expression, white cape, yellow bodysuit with a red belt, red gloves and red boots',
  },
};

/** Nom complet du personnage (« Levi » -> « Levi Ackerman »). */
function canonicalName(anime, character) {
  const aliases = ALIASES[anime] || {};
  return aliases[String(character).trim().toLowerCase()] || String(character).trim();
}

/** Fiche visuelle du personnage, ou null si on n'en a pas. */
function describeCharacter(q) {
  const sheets = CHARACTERS[q.anime] || {};
  return sheets[canonicalName(q.anime, q.character)] || null;
}

/**
 * Consigne pour le modèle d'images : la fiche du personnage d'abord (c'est ce qui pèse le plus),
 * puis le décor de son animé et l'ambiance du thème, avec de la place vide en bas pour la citation.
 * (Le texte est ajouté ensuite par le programme : on demande donc une image sans texte.)
 */
function buildImagePrompt(q) {
  const [mood] = moodFor(q.theme);
  const setting = settingFor(q.anime);
  const name = canonicalName(q.anime, q.character);
  const sheet = describeCharacter(q);
  const who = sheet ? `${name} from the anime ${q.anime}, ${sheet}` : `${name} from the anime ${q.anime}`;
  return [
    `Anime illustration of ${who}.`,
    `Background: ${setting}. Mood: ${mood}.`,
    'Detailed 2D anime key visual, clean sharp line art, cel shading, vibrant saturated colors, high contrast, cinematic lighting.',
    'Single character, full figure centered in the upper two thirds of a vertical 9:16 composition, dark empty space at the bottom.',
    'No text, no letters, no watermark, no logo.',
  ].join(' ');
}

module.exports = { buildImagePrompt, describeCharacter, canonicalName, moodFor, settingFor };
