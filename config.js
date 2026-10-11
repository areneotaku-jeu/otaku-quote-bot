'use strict';

const path = require('path');

const root = path.join(__dirname, '..');

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
    quotes: process.env.QUOTES_PATH || path.join(root, 'data', 'quotes.json'),
    // Sur Railway, pointer STATE_PATH vers un volume (ex. /data/state.json),
    // sinon la liste des citations déjà postées est perdue à chaque redéploiement.
    state: process.env.STATE_PATH || path.join(root, 'data', 'state.json'),
    output: process.env.OUTPUT_DIR || path.join(root, 'output'),
    fontBold: path.join(root, 'fonts', 'Poppins-Bold.ttf'),
    fontMedium: path.join(root, 'fonts', 'Poppins-Medium.ttf'),
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
