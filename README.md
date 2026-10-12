# Picaillon — code source

Appli de devis, factures et suivi URSSAF pour micro-entrepreneurs, et son site.

## Contenu
- `src/` : l'appli (cœur métier `core.js`, QR code `qr.js`, exemple `demo.js`, interface `app.js`, styles `styles.css`).
- `site-src/` : le site (pages, styles, service worker) et `generated/` (polices, icônes, images).
- `netlify.toml` : réglages Netlify (construction automatique, en-têtes de sécurité).
- `tests/` : tests du cœur métier (`node --test tests/*.test.js`).
- `marketing/` : logo et vidéo de présentation.
- `site-config.json` : nom de l'éditeur, ville, e-mail de contact, adresse du site.
- `build.py` : construit `pecule.html`, la version qui tourne dans Claude.
- `build_site.py` : construit le site à déposer sur Netlify dans `dist/site/`.
- `make_assets.py` : refait polices et icônes, puis (avec `--shots`) captures d'écran, image de partage et visuels des stores.

## Mise en ligne
Netlify est relié à ce dépôt : chaque modification fusionnée dans `main` lance les tests puis `python3 build_site.py`, et publie `dist/site`. Chaque pull request reçoit une adresse d'aperçu.

Dépôt manuel (sans GitHub) : `python3 build_site.py`, puis glisser le dossier `dist/site` dans Netlify.

## Reconstruire le site
```
python3 make_assets.py            # polices + icônes
python3 build_site.py             # site -> dist/site
python3 make_assets.py --shots    # captures (Playwright + Chromium)
python3 build_site.py             # reprend les captures
```
Prérequis : Python 3 avec fontTools, Pillow et Playwright ; Node.js (lecture des taux dans `core.js`).

## Mettre à jour les taux URSSAF
Tout est dans `src/core.js` (`ACTIVITES`, `ANNEE_REF`, `DIFF`). Le site reprend ces taux automatiquement.
