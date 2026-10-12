"""Polices, icônes et images du site Picaillon (à lancer avant build_site.py, puis --shots après).

    python3 make_assets.py           -> polices + icônes
    python3 make_assets.py --shots   -> captures d'écran, image de partage, visuels des stores (site déjà construit)
"""
import pathlib, sys, shutil, subprocess, time, http.server, threading, functools, json
ROOT = pathlib.Path(__file__).parent
GEN = ROOT / 'site-src' / 'generated'
STORE = ROOT / 'dist' / 'store'
ACCENT = '#2340D8'

def fonts():
    from fontTools import subset
    from fontTools.ttLib import TTFont
    out = GEN / 'fonts'; out.mkdir(parents=True, exist_ok=True)
    unicodes = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [0x131, 0x152, 0x153, 0x178, 0x2C6, 0x2DA, 0x2DC] + \
        list(range(0x2010, 0x2028)) + list(range(0x2030, 0x203B)) + [0x202F, 0x2044, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2248, 0x2260, 0x2264, 0x2265, 0x2713, 0xFEFF, 0xFFFD]
    inter = pathlib.Path('/usr/share/fonts/opentype/inter')
    jobs = [('Inter-Regular.otf', 'inter-400'), ('Inter-Medium.otf', 'inter-500'), ('Inter-SemiBold.otf', 'inter-600'), ('Inter-Bold.otf', 'inter-700'),
            ('InterDisplay-SemiBold.otf', 'inter-display-600'), ('InterDisplay-Bold.otf', 'inter-display-700')]
    for src, name in jobs:
        opts = subset.Options()
        opts.flavor = 'woff'
        opts.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'tnum', 'case']
        opts.name_IDs = ['*']; opts.notdef_outline = True; opts.drop_tables += ['DSIG']
        f = subset.load_font(str(inter / src), opts)
        s = subset.Subsetter(opts); s.populate(unicodes=unicodes); s.subset(f)
        subset.save_font(f, str(out / (name + '.woff')), opts)
    lic = pathlib.Path('/usr/share/doc/fonts-inter/copyright').read_text()
    (out / 'LICENCE-Inter.txt').write_text('Inter — Copyright 2016-2023 The Inter Project Authors (https://github.com/rsms/inter)\n'
                                          'Licence SIL Open Font License 1.1 — fichiers allégés (sous-ensemble de caractères latins) pour le web.\n\n' + lic)
    for p in sorted(out.iterdir()):
        print(' ', p.name, round(p.stat().st_size / 1024), 'Ko')

GLYPH = ('<rect x="16" y="13" width="10.5" height="38" rx="5.25" fill="#FFFFFF"/><circle cx="35" cy="27" r="14" fill="#FFFFFF"/>'
         '<circle cx="35" cy="27" r="8.4" fill="none" stroke="%s" stroke-width="3.2"/>' % ACCENT)
def icon_svg(size, rounded=True, scale=1.0, bg=ACCENT):
    g = '<g transform="translate(32 32) scale(%s) translate(-32.5 -32)">%s</g>' % (scale, GLYPH)
    rect = '<rect width="64" height="64"%s fill="%s"/>' % (' rx="15"' if rounded else '', bg)
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="%d" height="%d">%s%s</svg>' % (size, size, rect, g)

def render_svgs(items):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        for svg, size, path, alpha in items:
            pg = b.new_page(viewport={'width': size, 'height': size})
            pg.set_content('<html><body style="margin:0;background:transparent">' + svg.replace('<svg ', '<svg style="display:block" ', 1) + '</body></html>')
            pg.screenshot(path=str(path), omit_background=alpha, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
            pg.close()
        b.close()

def icons():
    out = GEN / 'icons'; out.mkdir(parents=True, exist_ok=True); STORE.mkdir(parents=True, exist_ok=True)
    (out / 'favicon.svg').write_text(icon_svg(64).replace(' width="64" height="64"', ''))
    render_svgs([
        (icon_svg(32), 32, out / 'favicon-32.png', True),
        (icon_svg(180, rounded=False), 180, out / 'apple-touch-icon.png', False),
        (icon_svg(192), 192, out / 'icon-192.png', True),
        (icon_svg(512), 512, out / 'icon-512.png', True),
        (icon_svg(512, rounded=False, scale=0.82), 512, out / 'icon-maskable-512.png', False),
        (icon_svg(512, rounded=False), 512, STORE / 'google-play-icone-512.png', False),
        (icon_svg(1024, rounded=False), 1024, STORE / 'app-store-icone-1024.png', False),
    ])
    # App Store : icône sans transparence
    from PIL import Image
    im = Image.open(STORE / 'app-store-icone-1024.png').convert('RGB'); im.save(STORE / 'app-store-icone-1024.png')
    for p in sorted(out.iterdir()):
        print(' ', p.name, p.stat().st_size, 'o')

# ---------- Captures (site construit dans dist/site, servi en local) ----------
def serve(directory, port):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=str(directory))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

PREP = """() => {
  const st = window.Demo.demoState(window.Core.todayIso());
  localStorage.clear();
  localStorage.setItem('encaisse:v1', JSON.stringify(st));
  localStorage.setItem('encaisse:v1:backup', String(Date.now()));
  localStorage.setItem('encaisse:v1:install-hide', '1');
}"""

def shots():
    from playwright.sync_api import sync_playwright
    from PIL import Image
    img = GEN / 'img'; img.mkdir(parents=True, exist_ok=True); STORE.mkdir(parents=True, exist_ok=True)
    tmp = ROOT / 'dist' / 'shots'; tmp.mkdir(parents=True, exist_ok=True)
    srv = serve(ROOT / 'dist' / 'site', 8765)
    base = 'http://127.0.0.1:8765/'
    with sync_playwright() as p:
        b = p.chromium.launch()
        def app_page(w, h, dsf, dark=False):
            ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf, color_scheme='dark' if dark else 'light',
                                service_workers='block', locale='fr-FR', timezone_id='Europe/Paris')
            pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(base + 'app/'); pg.wait_for_function('window.Demo && window.Core')
            pg.evaluate(PREP); pg.reload(); pg.wait_for_selector('.hero, .topbar')
            pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
            return ctx, pg, errs
        def tab(pg, v):
            pg.locator('.tabbar [data-v="%s"]:visible, .side [data-v="%s"]:visible' % (v, v)).first.click(); pg.wait_for_timeout(250)
        def open_doc(pg, pred):
            doc_id = pg.evaluate("""(pred) => { const st = JSON.parse(localStorage.getItem('encaisse:v1'));
              const d = st.docs.filter(x => eval(pred)).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]; return d && d.id; }""", pred)
            tab(pg, 'docs')
            pg.locator('[data-act="open"][data-id="%s"]:visible' % doc_id).first.click(); pg.wait_for_timeout(300)
        # Téléphone 390 x 844, x2
        ctx, pg, errs = app_page(390, 844, 2)
        pg.screenshot(path=str(tmp / 'accueil.png'))
        open_doc(pg, "x.type === 'facture' && x.statut === 'envoyee'")
        sheet = pg.locator('.sheet').first
        sheet.scroll_into_view_if_needed(); pg.evaluate("(() => { const q = document.querySelector('.sheet-qr') || document.querySelector('.sheet'); const r = q.getBoundingClientRect(); window.scrollTo(0, Math.max(0, r.bottom + window.scrollY - (window.innerHeight - 110))); })()"); pg.wait_for_timeout(200)
        pg.screenshot(path=str(tmp / 'facture.png'))
        tab(pg, 'urssaf')
        pg.evaluate("(() => { const h = [...document.querySelectorAll('h2')].find(x => /^Périodes/.test(x.textContent.trim())); if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 84); })()"); pg.wait_for_timeout(200)
        pg.screenshot(path=str(tmp / 'urssaf.png'))
        # Signature d'un devis sur place
        open_doc(pg, "x.type === 'devis' && x.statut === 'envoye'")
        pg.locator('[data-act="sign"]:visible').first.click(); pg.wait_for_timeout(300)
        box = pg.locator('#sign-canvas').bounding_box()
        import math
        def stroke(pts):
            pg.mouse.move(box['x'] + pts[0][0] * box['width'], box['y'] + pts[0][1] * box['height']); pg.mouse.down()
            for x, y in pts[1:]:
                pg.mouse.move(box['x'] + x * box['width'], box['y'] + y * box['height'], steps=2)
            pg.mouse.up()
        # « K. Benali » stylisé : un K, puis une écriture liée en boucles, puis un trait
        stroke([(0.14, 0.28), (0.13, 0.5), (0.12, 0.74)])
        stroke([(0.27, 0.3), (0.2, 0.47), (0.14, 0.52), (0.22, 0.58), (0.3, 0.76)])
        tw = 2 * math.pi
        stroke([(0.3 + 0.52 * t - 0.035 * math.sin(tw * 5.5 * t), 0.56 - (0.15 if int(t * 5.5) % 2 == 0 else 0.09) * math.cos(tw * 5.5 * t) * (1 - 0.35 * t)) for t in [i / 120 for i in range(121)]])
        stroke([(0.2 + t * 0.66, 0.84 - t * 0.05 + 0.015 * math.sin(t * 6)) for t in [i / 24 for i in range(25)]])
        pg.wait_for_timeout(200)
        pg.screenshot(path=str(tmp / 'devis.png'))
        print('  erreurs page téléphone :', errs or 'aucune')
        ctx.close()
        # Ordinateur
        ctx, pg, errs = app_page(1440, 900, 1)
        pg.screenshot(path=str(tmp / 'large.png'))
        ctx.close()
        for name in ['accueil', 'facture', 'urssaf']:
            Image.open(tmp / (name + '.png')).convert('RGB').save(img / ('ecran-%s.webp' % name), 'WEBP', quality=86, method=6)
        Image.open(tmp / 'large.png').convert('RGB').save(img / 'ecran-large.webp', 'WEBP', quality=84, method=6)

        # Visuels marketing : image de partage + captures légendées pour les stores
        def shot_html(html_body, w, h, path, dsf=1):
            ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf)
            pg = ctx.new_page()
            pg.set_content(html_body, wait_until='load'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(200)
            pg.screenshot(path=str(path)); ctx.close()
        fonts_css = ''.join("@font-face{font-family:'%s';font-weight:%d;src:url('%s')}" % (fam, w, (GEN / 'fonts' / (f + '.woff')).as_uri())
                            for fam, w, f in [('Inter', 400, 'inter-400'), ('Inter', 600, 'inter-600'), ('Inter Display', 700, 'inter-display-700')])
        import base64
        def data_uri(path, mime='image/png'):
            return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(path).read_bytes()).decode())
        icon_uri = data_uri(GEN / 'icons' / 'icon-512.png')
        inv = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#FFFFFF"/>'
               '<rect x="16" y="13" width="10.5" height="38" rx="5.25" fill="%s"/><circle cx="35" cy="27" r="14" fill="%s"/>'
               '<circle cx="35" cy="27" r="8.4" fill="none" stroke="#FFFFFF" stroke-width="3.2"/></svg>') % (ACCENT, ACCENT)
        icon_inv_uri = 'data:image/svg+xml;base64,' + base64.b64encode(inv.encode()).decode()
        import re as _re
        wm = _re.search(r"var WORDMARK = '(.*?)';\n", (ROOT / 'src' / 'app.js').read_text()).group(1)
        WM_WHITE = wm.replace('currentColor', '#FFFFFF').replace('var(--accent)', '#9FB0FF').replace('class="wordmark"', 'style="height:82px;width:auto;display:block"')
        def phone(src, w):
            return ('<div style="width:%dpx;aspect-ratio:390/844;border-radius:%dpx;padding:%dpx;background:#0E1222;box-shadow:0 30px 80px -30px rgba(0,0,0,.55)">'
                    '<img src="%s" style="width:100%%;height:100%%;object-fit:cover;object-position:top;border-radius:%dpx;display:block"></div>') % (w, w * 0.15, w * 0.035, data_uri(tmp / src), w * 0.12)
        base_css = "<style>%s *{box-sizing:border-box} body{margin:0;font-family:Inter;-webkit-font-smoothing:antialiased}</style>" % fonts_css
        # Image de partage 1200 x 630
        shot_html(base_css + '''<div style="width:1200px;height:630px;background:#F1F3F8;display:flex;align-items:center;gap:40px;padding:0 0 0 80px;overflow:hidden;position:relative">
          <div style="flex:1"><div><img src="%s" style="height:70px;display:block"></div>
          <div style="font-family:'Inter Display';font-weight:700;font-size:58px;line-height:1.05;color:#141829;letter-spacing:-.025em;margin-top:34px">Facturez en 2 minutes.<br><span style="color:%s">Sachez ce qui vous reste.</span></div>
          <div style="font-size:24px;color:#5A6175;margin-top:22px">Devis, factures et URSSAF pour les auto-entrepreneurs</div></div>
          <div style="width:400px;height:630px;position:relative;flex:none"><div style="position:absolute;top:60px;left:40px">%s</div></div></div>''' % (data_uri(str(ROOT / 'marketing' / 'logo' / 'picaillon-logo.svg'), 'image/svg+xml'), ACCENT, phone('accueil.png', 300)),
                  1200, 630, img / 'og.png')
        # Captures légendées pour les stores
        captions = [('accueil', 'Votre vrai net en poche', 'Cotisations, impôt et frais déduits'),
                    ('devis', 'Un devis en 2 minutes', 'Signé sur place, sur votre téléphone'),
                    ('facture', 'Des factures conformes', 'Mentions légales et QR code de virement'),
                    ('urssaf', "L'URSSAF sous contrôle", 'Le montant à déclarer, la date limite')]
        def store_shot(name, title, sub, W, H, path):
            pw = int(W * 0.74)
            shot_html(base_css + '''<div style="width:%dpx;height:%dpx;background:%s;display:flex;flex-direction:column;align-items:center;overflow:hidden;color:#fff;text-align:center">
              <div style="padding:%dpx %dpx 0"><div style="font-family:'Inter Display';font-weight:700;font-size:%dpx;line-height:1.05;letter-spacing:-.02em">%s</div>
              <div style="font-size:%dpx;opacity:.85;margin-top:%dpx;font-weight:400">%s</div></div>
              <div style="margin-top:%dpx">%s</div></div>''' % (W, H, ACCENT, H * 0.06, W * 0.07, W * 0.085, title, W * 0.042, H * 0.012, sub, H * 0.045, phone(name + '.png', pw)),
                      W, H, path)
        for i, (name, title, sub) in enumerate(captions, 1):
            store_shot(name, title, sub, 1080, 1920, STORE / ('google-play-capture-%d.png' % i))
            store_shot(name, title, sub, 1290, 2796, STORE / ('app-store-capture-%d.png' % i))
            Image.open(STORE / ('app-store-capture-%d.png' % i)).convert('RGB').save(STORE / ('app-store-capture-%d.png' % i))
        # Bannière Google Play 1024 x 500
        shot_html(base_css + '''<div style="width:1024px;height:500px;background:%s;display:flex;align-items:center;gap:36px;padding:0 60px;color:#fff;overflow:hidden">
          <img src="%s" style="width:150px;height:150px">
          <div><div style="height:82px">%s</div>
          <div style="font-size:30px;margin-top:16px;opacity:.9;line-height:1.25">Devis, factures et URSSAF<br>pour les auto-entrepreneurs</div></div></div>''' % (ACCENT, icon_inv_uri, WM_WHITE), 1024, 500, STORE / 'google-play-banniere-1024x500.png')
        b.close()
    srv.shutdown()
    for p in sorted(list(img.iterdir()) + list(STORE.iterdir())):
        print(' ', p.relative_to(ROOT), round(p.stat().st_size / 1024), 'Ko')

if __name__ == '__main__':
    if '--shots' in sys.argv:
        shots()
    else:
        fonts(); icons()
