# Otaku Quote Bot — étape 1 (citation, image, légende)

Mode test (ne publie rien) :

    npm install
    node scripts/test-post.js --slot fr-midi        # citation FR
    node scripts/test-post.js --slot us-afternoon   # citation EN
    node scripts/test-post.js --id 3 --no-hf        # une citation précise, sans Hugging Face

Le résultat (photo .jpg + .json avec légende et consigne d'image) est écrit dans `output/`.

Variables d'environnement : HF_TOKEN, HF_IMAGE_ENABLED=true, HF_IMAGE_MODEL (facultatif),
STATE_PATH (sur Railway : un chemin dans un volume, ex. /data/state.json).
