# Picaillon — consignes de travail pour Claude

Picaillon est une app web installable (PWA) de devis, factures et suivi URSSAF pour micro-entrepreneurs français, avec son site vitrine. Tout est en français. Propriétaire : Erwan Battus. Site en ligne : https://picaillonv1.netlify.app

## Organisation du code
- `src/core.js` : cœur métier sans DOM (taux URSSAF 2026, cotisations, numérotation, PDF, Factur-X, CSV). Testable dans Node.
- `src/app.js`, `src/styles.css`, `src/qr.js`, `src/demo.js` : l'interface de l'app.
- `site-src/` : pages du site, styles, service worker, et `generated/` (polices, icônes, images).
- `build_site.py` : construit le site complet dans `dist/site` (c'est ce que Netlify publie).
- `build.py` : construit `pecule.html`, la version qui tourne comme artefact dans Claude.
- `make_assets.py` : refait polices, icônes et captures (Pillow, fontTools, Playwright) ; rarement utile.
- `tests/` : tests Node du cœur métier.
- `marketing/` : logo et vidéo de présentation (hors site).

## Commandes
- Tests : `node --test tests/*.test.js`
- Site : `python3 build_site.py` (Python 3 standard + Node, aucune dépendance à installer)
- Aperçu local sans formulaires ni service worker : `python3 build_site.py --preview`

## Règles
1. Ne jamais pousser sur `main` ni fusionner une pull request. Chaque changement se fait sur une branche `agent/<sujet-court>` et part en pull request vers `main` ; Erwan teste l'aperçu Netlify et fusionne lui-même (chaque mise en ligne coûte des crédits Netlify).
2. Un sujet par pull request, le plus petit changement qui règle le problème.
3. Avant de pousser : tests et `python3 build_site.py` doivent passer. Toute modification de `core.js` ajoute ou met à jour un test.
4. Ne jamais changer un taux, un plafond ou une règle légale sans source officielle (urssaf.fr, impots.gouv.fr, service-public.fr, legifrance.gouv.fr) citée dans la pull request.
5. Garder les promesses du produit : pas de compte, pas de publicité, pas de traqueur, aucune donnée envoyée hors du téléphone, aucun script ou police chargé depuis un autre site (la politique de sécurité dans `netlify.toml` l'interdit).
6. Ne pas modifier sans demande explicite d'Erwan : `site-config.json`, mentions légales, politique de confidentialité, conditions d'utilisation, `netlify.toml`.
7. Description de pull request en français : ce qui change, pourquoi (lien vers la ligne du backlog si elle existe), comment c'est testé, ce qu'Erwan doit vérifier sur l'aperçu.
