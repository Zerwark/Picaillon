"""Construit le site Picaillon prêt à déposer sur Netlify.

    python3 build_site.py                 -> dist/site/
    python3 build_site.py --preview       -> dist/preview/ (formulaires désactivés, sans service worker)

Les réglages (nom de l'éditeur, adresse du site…) sont dans site-config.json.
"""
import hashlib, html, json, os, pathlib, re, shutil, subprocess, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'src'
SITE_SRC = ROOT / 'site-src'
PREVIEW = '--preview' in sys.argv
OUT = ROOT / 'dist' / ('preview' if PREVIEW else 'site')
CFG = json.loads((ROOT / 'site-config.json').read_text())
SITE_URL = CFG['siteUrl'].rstrip('/')
# Polices hébergées sur le site (aucun appel à Google) : Inter et Inter Display
FONT_FILES = [('Inter', 400, 'inter-400'), ('Inter', 500, 'inter-500'), ('Inter', 600, 'inter-600'), ('Inter', 700, 'inter-700'),
              ('Inter Display', 600, 'inter-display-600'), ('Inter Display', 700, 'inter-display-700')]
def font_faces(prefix):
    css = ''.join("@font-face { font-family: '%s'; font-style: normal; font-weight: %d; font-display: swap; src: url('%s%s.woff') format('woff'); }\n" % (fam, w, prefix, f) for fam, w, f in FONT_FILES)
    return css + ":root { --f-display: 'Inter Display', 'Inter', ui-sans-serif, system-ui, sans-serif; --f-body: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; --f-mono: 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace; }\n"
def preload(prefix):
    return ''.join('<link rel="preload" href="%s%s.woff" as="font" type="font/woff" crossorigin>\n' % (prefix, f) for f in ['inter-400', 'inter-display-700'])

def h(s, n=10):
    return hashlib.sha256(s.encode() if isinstance(s, str) else s).hexdigest()[:n]

# ---------- Appli : mêmes sources que l'artefact ----------
app_js = '\n'.join((SRC / f).read_text() for f in ['core.js', 'qr.js', 'demo.js', 'app.js'])
app_css = (SRC / 'styles.css').read_text() + '\n/* Polices du site */\n' + font_faces('../assets/fonts/')
APP_V = h(app_js + app_css)
WORDMARK = re.search(r"var WORDMARK = '(.*?)';\n", (SRC / 'app.js').read_text()).group(1)
LOGO = ('<svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="var(--accent)"/>'
        '<rect x="16" y="13" width="10.5" height="38" rx="5.25" fill="var(--accent-ink)"/><circle cx="35" cy="27" r="14" fill="var(--accent-ink)"/>'
        '<circle cx="35" cy="27" r="8.4" fill="none" stroke="var(--accent)" stroke-width="3.2"/></svg>')

# Taux de l'année, lus dans core.js pour que le site et l'appli disent la même chose
rates = json.loads(subprocess.check_output(['node', '-e', '''
const C = require(process.argv[1]), out = {};
for (const k of Object.keys(C.ACTIVITES)) { const a = C.ACTIVITES[k]; out[k] = {label: a.label, social: a.social, cfp: a.cfp, vl: a.vl}; }
console.log(JSON.stringify({annee: C.ANNEE_REF, rates: out}));
''', str(SRC / 'core.js')]))

# ---------- Icônes du site ----------
P = {
    'next': '<path d="M9 18l6-6-6-6"/>',
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'doc': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    'bank': '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    'euro': '<path d="M17.5 6.5A7 7 0 1 0 17.5 17.5"/><path d="M4 10h9M4 14h9"/>',
    'bell': '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    'pen': '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 20h6"/>',
    'qr': '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2"/>',
    'send': '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
    'book': '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
    'spark': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    'lock': '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
}
def icon(name, size=20):
    if name == 'check32':
        return icon('check', 32)
    return ('<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (size, size, P[name]))

METIERS = ['Artisan du bâtiment', 'Autre artisan', 'Commerce, vente', 'Services, freelance, conseil',
           'Profession libérale', 'Pas encore installé', 'Autre']

# ---------- Gabarit commun ----------
def layout(path, title, desc, body, base='', noindex=False, home=False):
    canon = SITE_URL + '/' + ('' if path == 'index.html' else path)
    head_title = title if home else title + ' · Picaillon'
    anchor = '' if home else base + 'index.html'
    nav = ''.join('<a href="%s#%s">%s</a>' % (anchor, a, l) for a, l in [('fonctions', 'Fonctionnalités'), ('calcul', 'Combien il me reste'), ('tarifs', 'Tarifs'), ('faq', 'FAQ')])
    foot_links = [('app/', 'Ouvrir l\'appli'), ('avis.html', 'Donner mon avis'), ('contact.html', 'Contact'),
                  ('mentions-legales.html', 'Mentions légales'), ('confidentialite.html', 'Confidentialité'), ('conditions.html', 'Conditions d\'utilisation')]
    return f'''<!doctype html>
<html lang="fr"{' data-preview' if PREVIEW else ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(head_title)}</title>
<meta name="description" content="{html.escape(desc)}">
{'<meta name="robots" content="noindex">' if noindex else f'<link rel="canonical" href="{canon}">'}
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Picaillon">
<meta property="og:title" content="{html.escape(head_title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{SITE_URL}/assets/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F1F3F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0D1020" media="(prefers-color-scheme: dark)">
<link rel="icon" href="{base}assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="{base}assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="{base}assets/icons/apple-touch-icon.png">
{preload(base + 'assets/fonts/')}<link rel="stylesheet" href="{base}assets/site.css?v={SITE_V}">
<script src="{base}assets/site.js?v={SITE_V}" defer></script>
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="top"><div class="wrap">
  <a class="brand" href="{base}index.html" aria-label="Picaillon, accueil">{LOGO}{WORDMARK}</a>
  <nav aria-label="Sections">{nav}</nav>
  <a class="btn btn-primary btn-sm" href="{base}app/">Ouvrir l'appli</a>
</div></header>
<main id="contenu">
{body}
</main>
<footer class="foot"><div class="wrap">
  <div><a class="brand" href="{base}index.html" aria-label="Picaillon">{LOGO}{WORDMARK}</a><p style="margin-top:10px">Devis, factures et URSSAF pour les micro-entrepreneurs.<br>© <span id="year">2026</span> {html.escape(CFG['editeur'])} · Version de test</p></div>
  <nav aria-label="Liens utiles">{''.join('<a href="%s%s">%s</a>' % (base, u, l) for u, l in foot_links)}</nav>
</div></footer>
</body>
</html>
'''

NNBSP, NBSP = '\u202f', '\u00a0'
def typo(text):
    """Espaces insécables à la française dans le texte (pas dans les balises)."""
    parts = re.split(r'(<[^>]+>)', text)
    for i, t in enumerate(parts):
        if i % 2 or not t.strip():
            continue
        t = re.sub(r' ([?!;])', NNBSP + r'\1', t)
        t = re.sub(r' :', NBSP + ':', t)
        t = t.replace('« ', '«' + NBSP).replace(' »', NBSP + '»')
        t = re.sub(r'(\d) (?=\d{3}\b)', '\\1' + NNBSP, t)
        t = re.sub(r'(\d) ([€%])', '\\1' + NBSP + '\\2', t)
        t = re.sub(r'\b(art\.|n°) ', '\\1' + NBSP, t)
        parts[i] = t
    return ''.join(parts)

def fill(text):
    email = CFG.get('email', '').strip()
    rep = {
        'editeur': html.escape(CFG['editeur']),
        'ville': html.escape(CFG['ville']),
        'maj': html.escape(CFG['miseAJour']),
        'annee': str(rates['annee']),
        'rates': html.escape(json.dumps(rates['rates'], ensure_ascii=False), quote=True).replace('&#x27;', '&#39;'),
        'activites': ''.join('<option value="%s"%s>%s</option>' % (k, ' selected' if k == 'artisan' else '', html.escape(v['label'])) for k, v in rates['rates'].items()),
        'metiers': '<option value="">Choisir…</option>' + ''.join('<option>%s</option>' % html.escape(m) for m in METIERS),
        'scale': ''.join('<label><input type="radio" name="Recommande à un collègue (sur 10)" value="%d" aria-label="%d sur 10">%d</label>' % (i, i, i) for i in range(11)),
        'email_inline': (' ou <a href="mailto:%s">%s</a>' % (html.escape(email), html.escape(email))) if email else '',
        'contact_email': ('<p class="muted" style="margin-top:16px">Vous pouvez aussi écrire directement à <a href="mailto:%s">%s</a>.</p>' % (html.escape(email), html.escape(email))) if email else '',
    }
    def sub(m):
        k = m.group(1)
        if k.startswith('icon:'):
            return icon(k[5:])
        return rep[k]
    return re.sub(r'\{\{([a-z_:0-9]+)\}\}', sub, text)

# ---------- Écriture ----------
if OUT.exists():
    shutil.rmtree(OUT)
(OUT / 'app').mkdir(parents=True)
(OUT / 'assets').mkdir()
site_css = (SITE_SRC / 'site.css').read_text() + '\n/* Polices */\n' + font_faces('fonts/')
site_js = (SITE_SRC / 'site.js').read_text()
SITE_V = h(site_css + site_js)
(OUT / 'assets' / 'site.css').write_text(site_css)
(OUT / 'assets' / 'site.js').write_text(site_js)
for sub in ['icons', 'img', 'fonts']:
    src = SITE_SRC / 'generated' / sub
    if src.exists():
        shutil.copytree(src, OUT / 'assets' / sub)

PAGES = [
    ('index.html', 'Picaillon · Devis, factures et URSSAF pour auto-entrepreneurs', 'Faites vos devis et factures conformes en 2 minutes, suivez vos déclarations URSSAF et voyez ce qu\'il vous reste vraiment. Gratuit, sur votre téléphone.', {'home': True}),
    ('avis.html', 'Votre avis', 'Dites-nous ce qui marche, ce qui bloque et ce qui manque dans Picaillon.', {}),
    ('contact.html', 'Contact', 'Écrire à l\'équipe de Picaillon.', {}),
    ('merci.html', 'Merci', 'Votre message est bien arrivé.', {'noindex': True}),
    ('mentions-legales.html', 'Mentions légales', 'Mentions légales du site et de l\'application Picaillon.', {}),
    ('confidentialite.html', 'Politique de confidentialité', 'Comment Picaillon traite vos données : l\'essentiel reste sur votre appareil.', {}),
    ('conditions.html', 'Conditions d\'utilisation', 'Conditions d\'utilisation du site et de l\'application Picaillon.', {}),
    ('404.html', 'Page introuvable', 'Cette page n\'existe pas.', {'noindex': True, 'base': '/'}),
]
for name, title, desc, opt in PAGES:
    body = typo(fill((SITE_SRC / 'pages' / name).read_text()))
    base = opt.get('base', '')
    if PREVIEW and base == '/':
        base = ''
    (OUT / name).write_text(layout(name, title, desc, body, base=base, noindex=opt.get('noindex', False), home=opt.get('home', False)))

# Appli
(OUT / 'app' / 'picaillon.js').write_text(app_js)
(OUT / 'app' / 'picaillon.css').write_text(app_css)
sw_attr = '' if PREVIEW else ' data-sw="sw.js"'
(OUT / 'app' / 'index.html').write_text(f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Picaillon</title>
<meta name="description" content="Devis, factures et URSSAF pour micro-entrepreneurs">
<meta name="theme-color" content="#F1F3F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0D1020" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="../assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="../assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="../assets/icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Picaillon">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
{preload('../assets/fonts/')}<link rel="stylesheet" href="picaillon.css?v={APP_V}">
</head>
<body>
<div id="app" data-web data-avis="../avis.html" data-legal="../"{sw_attr}></div>
<noscript><p style="padding:24px;font-family:system-ui">Picaillon a besoin de JavaScript pour fonctionner. Activez-le dans votre navigateur.</p></noscript>
<script src="picaillon.js?v={APP_V}"></script>
</body>
</html>
''')
manifest = {
    'id': '/app/', 'name': 'Picaillon', 'short_name': 'Picaillon',
    'description': 'Devis, factures et URSSAF pour micro-entrepreneurs',
    'lang': 'fr', 'dir': 'ltr', 'start_url': './?source=pwa', 'scope': './', 'display': 'standalone',
    'background_color': '#F1F3F8', 'theme_color': '#F1F3F8', 'categories': ['business', 'finance', 'productivity'],
    'icons': [
        {'src': '../assets/icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': '../assets/icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
        {'src': '../assets/icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
    'screenshots': [
        {'src': '../assets/img/ecran-accueil.webp', 'sizes': '780x1688', 'type': 'image/webp', 'form_factor': 'narrow', 'label': 'Votre net en poche et vos déclarations'},
        {'src': '../assets/img/ecran-facture.webp', 'sizes': '780x1688', 'type': 'image/webp', 'form_factor': 'narrow', 'label': 'Des factures conformes avec QR code de virement'},
        {'src': '../assets/img/ecran-urssaf.webp', 'sizes': '780x1688', 'type': 'image/webp', 'form_factor': 'narrow', 'label': 'Les périodes URSSAF et les montants à déclarer'},
        {'src': '../assets/img/ecran-large.webp', 'sizes': '1440x900', 'type': 'image/webp', 'form_factor': 'wide', 'label': 'Picaillon sur ordinateur'},
    ],
}
(OUT / 'app' / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
if not PREVIEW:
    (OUT / 'app' / 'sw.js').write_text((SITE_SRC / 'sw.js').read_text().replace('__VERSION__', APP_V))
    if os.environ.get('NETLIFY') != 'true':   # dépôt manuel du zip : Netlify lit ce fichier dans le dossier déposé
        conf = (ROOT / 'netlify.toml').read_text()
        conf = re.sub(r'\[build\]\n(  .*\n)+', '[build]\n  publish = "."\n', conf, count=1)
        (OUT / 'netlify.toml').write_text(conf)
    (OUT / 'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /merci.html\n\nSitemap: %s/sitemap.xml\n' % SITE_URL)
    urls = ['', 'app/', 'avis.html', 'contact.html', 'mentions-legales.html', 'confidentialite.html', 'conditions.html']
    (OUT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
                                     ''.join('  <url><loc>%s/%s</loc></url>\n' % (SITE_URL, u) for u in urls) + '</urlset>\n')
total = sum(f.stat().st_size for f in OUT.rglob('*') if f.is_file())
print('Site construit dans', OUT, '·', len([f for f in OUT.rglob('*') if f.is_file()]), 'fichiers ·', round(total / 1024), 'Ko · appli v' + APP_V)
