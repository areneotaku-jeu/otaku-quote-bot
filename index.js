'use strict';

// Point d'entrée des modules de l'étape 1 (citation, image, légende).
// Le serveur principal pourra les importer ainsi :
//   const { pickQuote, markPosted, buildCaption, renderPost } = require('./src');
module.exports = {
  ...require('./quotes'),
  ...require('./caption'),
  ...require('./image'),
  ...require('./prompt'),
  config: require('./config'),
};
