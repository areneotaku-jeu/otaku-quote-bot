'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Version "à plat" : tous les fichiers sont à la racine du dépôt.
const root = __dirname;

// Dossier où sont téléchargées les polices Google Fonts (effacé à chaque redéploiement, retéléchargé au démarrage)
const fontsDir = process.env.FONTS_DIR || path.join(os.tmpdir(), 'otaku-fonts');

// Sur Railway, le conteneur n'a ni configuration fontconfig ni polices système
// ("Fontconfig error: Cannot load default config file"). On crée donc ici une petite
// configuration qui désigne le dossier du dépôt, où se trouvent les polices Poppins.
// Doit être fait avant le chargement de sharp (c'est le cas : config.js est lu en premier).
if (!process.env.FONTCONFIG_FILE) {
  try {
    const dir = path.join(os.tmpdir(), 'otaku-fontconfig');
    fs.mkdirSync(path.join(dir, 'cache'), { recursive: true });
    const conf = path.join(dir, 'fonts.conf');
    fs.writeFileSync(
      conf,
      `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${root}</dir>
  <dir>${fontsDir}</dir>
  <cachedir>${path.join(dir, 'cache')}</cachedir>
</fontconfig>
`
    );
    process.env.FONTCONFIG_FILE = conf;
  } catch (err) {
    console.warn(`[config] configuration des polices impossible : ${err.message}`);
  }
}

module.exports = {
  root,

  // Format vertical TikTok (9:16)
  width: 1080,
  height: 1920,

  // 3 publications par jour, espacées de 8 h.
  // Chaque créneau impose la langue de la citation et le public visé.
  // (Le planificateur qui s'en sert sera ajouté à une étape ultérieure.)
  slots: [
    { id: 'fr-midi', lang: 'fr', country: 'France', timezone: 'Europe/Paris', time: '12:30' },
    { id: 'us-afternoon', lang: 'en', country: 'USA', timezone: 'America/New_York', time: '14:30' },
    { id: 'us-night', lang: 'en', country: 'USA', timezone: 'America/New_York', time: '22:30' },
  ],

  paths: {
    quotes: process.env.QUOTES_PATH || path.join(root, 'quotes.json'),
    // Sur Railway, pointer STATE_PATH vers un volume (ex. /data/state.json),
    // sinon la liste des citations déjà postées est perdue à chaque redéploiement.
    state: process.env.STATE_PATH || path.join(root, 'state.json'),
    output: process.env.OUTPUT_DIR || path.join(root, 'output'),
    fontsDir,
    fontBold: path.join(root, 'Poppins-Bold.ttf'),
    fontMedium: path.join(root, 'Poppins-Medium.ttf'),
  },

  fonts: {
    // GOOGLE_FONTS_ENABLED=false : n'utiliser que Poppins (aucun téléchargement)
    enabled: String(process.env.GOOGLE_FONTS_ENABLED || 'true').toLowerCase() !== 'false',
    cssUrl: process.env.GOOGLE_FONTS_CSS_URL || 'https://fonts.googleapis.com/css2',
    timeoutMs: Number(process.env.GOOGLE_FONTS_TIMEOUT_MS) || 15000,
  },

  // Ordre d'essai des générateurs d'images ; le dégradé sert de secours si tous échouent
  imageProviders: (process.env.IMAGE_PROVIDERS || 'cloudflare,huggingface')
    .split(',')
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean),

  // Cloudflare Workers AI (offre gratuite) : variables CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_API_TOKEN
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    token: process.env.CLOUDFLARE_API_TOKEN || '',
    model: process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell',
    steps: Number(process.env.CLOUDFLARE_IMAGE_STEPS) || 4,
    baseUrl: process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4',
    timeoutMs: Number(process.env.CLOUDFLARE_TIMEOUT_MS) || 60000,
  },

  hf: {
    enabled: String(process.env.HF_IMAGE_ENABLED || '').toLowerCase() === 'true',
    token: process.env.HF_TOKEN || '',
    model: process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell',
    // Résolution native demandée au modèle (9:16), agrandie ensuite à 1080x1920
    width: 768,
    height: 1344,
  },
};
