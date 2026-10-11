'use strict';

/**
 * Mode test : fabrique un post complet (photo + légende) SANS rien publier.
 *
 * Exemples :
 *   node scripts/test-post.js --lang fr
 *   node scripts/test-post.js --slot us-night
 *   node scripts/test-post.js --id 3
 *   node scripts/test-post.js --lang en --no-hf     (fond de secours, sans Hugging Face)
 *   node scripts/test-post.js --lang en --commit    (marque la citation comme "déjà postée")
 */

const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { loadQuotes, pickQuote, markPosted } = require('../src/quotes');
const { buildCaption } = require('../src/caption');
const { buildImagePrompt } = require('../src/prompt');
const { renderPost } = require('../src/image');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const quotes = loadQuotes();

  let quote;
  let cycleReset = false;

  if (args.id) {
    quote = quotes.find((q) => String(q.id) === String(args.id));
    if (!quote) throw new Error(`Citation ${args.id} introuvable`);
  } else {
    let lang = args.lang;
    if (args.slot) {
      const slot = config.slots.find((s) => s.id === args.slot);
      if (!slot) throw new Error(`Créneau inconnu. Valeurs possibles : ${config.slots.map((s) => s.id).join(', ')}`);
      lang = slot.lang;
    }
    if (!['fr', 'en'].includes(lang)) throw new Error('Indiquez --lang fr|en, --slot <id> ou --id <numéro>');
    ({ quote, cycleReset } = pickQuote(lang, { quotes }));
  }

  const caption = buildCaption(quote);
  const { jpeg, backgroundSource } = await renderPost(quote, { useHF: !args['no-hf'] });

  fs.mkdirSync(config.paths.output, { recursive: true });
  const base = path.join(config.paths.output, `post-${quote.id}-${quote.lang}`);
  fs.writeFileSync(`${base}.jpg`, jpeg);
  fs.writeFileSync(
    `${base}.json`,
    JSON.stringify({ quote, caption, imagePrompt: buildImagePrompt(quote), backgroundSource }, null, 2)
  );

  if (args.commit) markPosted(quote, { cycleReset });

  console.log(`Citation #${quote.id} (${quote.lang}) — ${quote.character}, ${quote.anime} [${quote.theme}]`);
  console.log(`Fond : ${backgroundSource}`);
  console.log(`Image : ${base}.jpg`);
  console.log(`\nTitre : ${caption.title}\n\n${caption.description}`);
  console.log(args.commit ? '\n(citation marquée comme postée)' : '\n(mode test : rien publié, état inchangé)');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
