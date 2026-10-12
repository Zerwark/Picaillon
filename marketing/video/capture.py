"""Captures des vrais écrans de Picaillon pour la vidéo (téléphone 390x844, échelle 3)."""
import json, math, pathlib, functools, http.server, threading
from playwright.sync_api import sync_playwright
OUT = pathlib.Path(__file__).resolve().parent / 'caps'; OUT.mkdir(parents=True, exist_ok=True)
SITE = str(pathlib.Path(__file__).resolve().parent.parents[1] / 'dist' / 'site')
DSF = 3
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8790), functools.partial(Q, directory=SITE))
threading.Thread(target=srv.serve_forever, daemon=True).start()
PREP = """() => { localStorage.clear(); const st = window.Demo.demoState(window.Core.todayIso());
  localStorage.setItem('encaisse:v1', JSON.stringify(st)); localStorage.setItem('encaisse:v1:backup', String(Date.now()));
  localStorage.setItem('encaisse:v1:install-hide', '1'); localStorage.setItem('encaisse:v1:welcome', '1'); }"""
meta = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=DSF, service_workers='block', locale='fr-FR', timezone_id='Europe/Paris')
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8790/app/'); pg.wait_for_function('window.Demo'); pg.evaluate(PREP); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate('document.fonts.ready')
    def tab(v): pg.locator('.tabbar [data-v="%s"]' % v).click(); pg.wait_for_timeout(300)
    def full(name):
        """Page entière sans la barre d'onglets + la barre d'onglets à part + hauteur de la barre du haut."""
        pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(150)
        pg.locator('.tabbar').screenshot(path=str(OUT / (name + '-tabbar.png')))
        top = pg.evaluate("Math.round(document.querySelector('.topbar').getBoundingClientRect().bottom)")
        pg.add_style_tag(content='.tabbar{display:none!important}')
        pg.screenshot(path=str(OUT / (name + '.png')), full_page=True)
        h = pg.evaluate('document.documentElement.scrollHeight')
        meta[name] = {'top': top, 'height': h}
        pg.evaluate("document.querySelectorAll('style').forEach(s => { if (s.textContent.includes('.tabbar{display:none')) s.remove(); })")
    def open_doc(pred):
        st = json.loads(pg.evaluate("localStorage.getItem('encaisse:v1')"))
        cand = [d for d in st['docs'] if eval(pred, {}, {'d': d})]
        cand.sort(key=lambda d: d.get('date') or '', reverse=True)
        tab('docs'); pg.locator('[data-act="open"][data-id="%s"]:visible' % cand[0]['id']).first.click(); pg.wait_for_timeout(400)
        return cand[0]
    # 1. Accueil
    full('accueil')
    # 2. Signature d'un devis envoyé
    dv = open_doc("d['type'] == 'devis' and d['statut'] == 'envoye'")
    meta['devis'] = {'numero': dv['numero']}
    pg.locator('[data-act="sign"]:visible').first.click(); pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / 'signature-vide.png'))
    box = pg.locator('#sign-canvas').bounding_box()
    meta['pad'] = box
    def stroke(pts):
        pg.mouse.move(box['x'] + pts[0][0] * box['width'], box['y'] + pts[0][1] * box['height']); pg.mouse.down()
        for x, y in pts[1:]: pg.mouse.move(box['x'] + x * box['width'], box['y'] + y * box['height'], steps=2)
        pg.mouse.up()
    tw = 2 * math.pi
    strokes = [
        [(0.14, 0.28), (0.13, 0.5), (0.12, 0.74)],
        [(0.27, 0.3), (0.2, 0.47), (0.14, 0.52), (0.22, 0.58), (0.3, 0.76)],
        [(0.3 + 0.52 * t - 0.035 * math.sin(tw * 5.5 * t), 0.56 - (0.15 if int(t * 5.5) % 2 == 0 else 0.09) * math.cos(tw * 5.5 * t) * (1 - 0.35 * t)) for t in [i / 120 for i in range(121)]],
        [(0.2 + t * 0.66, 0.84 - t * 0.05 + 0.015 * math.sin(t * 6)) for t in [i / 24 for i in range(25)]],
    ]
    meta['strokes'] = strokes
    for s in strokes: stroke(s)
    pg.wait_for_timeout(200)
    pg.screenshot(path=str(OUT / 'signature-faite.png'))
    pg.locator('[data-act="sign-ok"]').click(); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('toast') && (document.getElementById('toast').hidden = true)")
    meta['invoiceBtn'] = pg.evaluate("(() => { const e = document.querySelector('.actions [data-act=\"invoice\"]'); if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.x, y: r.y + scrollY, w: r.width, h: r.height}; })()")
    full('devis-accepte')
    meta['devis-accepte']['stamp'] = pg.evaluate("(() => { const e = document.querySelector('.stamp, .sheet-stamp'); if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.x, y: r.y + scrollY, w: r.width, h: r.height}; })()")
    # 3. Facture envoyée avec QR code
    fa = open_doc("d['type'] == 'facture' and d['statut'] == 'envoyee'")
    meta['facture'] = {'numero': fa['numero']}
    full('facture')
    meta['facture']['qr'] = pg.evaluate("(() => { const e = document.querySelector('.sheet-qr svg') || document.querySelector('.sheet-qr'); const r = e.getBoundingClientRect(); return {x: r.x, y: r.y + scrollY, w: r.width, h: r.height}; })()")
    meta['facture']['sheet'] = pg.evaluate("(() => { const r = document.querySelector('.sheet').getBoundingClientRect(); return {x: r.x, y: r.y + scrollY, w: r.width, h: r.height}; })()")
    meta['facture']['mentions'] = pg.evaluate("(() => { const els = [...document.querySelectorAll('.sheet *')].filter(e => /293 B|pénalités|SIRET/i.test(e.textContent) && e.children.length === 0); return els.map(e => { const r = e.getBoundingClientRect(); return {t: e.textContent.trim().slice(0, 60), y: r.y + scrollY, x: r.x, w: r.width, h: r.height}; }); })()")
    # 4. URSSAF
    tab('urssaf'); full('urssaf')
    meta['urssaf']['periodes'] = pg.evaluate("(() => { const h = [...document.querySelectorAll('h2')].find(x => /^Périodes/.test(x.textContent.trim())); return h ? Math.round(h.getBoundingClientRect().top + scrollY) : 0; })()")
    # Accueil : positions utiles
    tab('home')
    meta['accueil']['hero'] = pg.evaluate("(() => { const r = document.querySelector('.hero').getBoundingClientRect(); return {x: r.x, y: r.y + scrollY, w: r.width, h: r.height}; })()")
    meta['accueil']['urssafCard'] = pg.evaluate("(() => { const c = [...document.querySelectorAll('.card')].find(x => /Déclaration URSSAF/.test(x.textContent)); if (!c) return null; const r = c.getBoundingClientRect(); return {x: r.x, y: r.y + scrollY, w: r.width, h: r.height}; })()")
    print('erreurs', errs)
    b.close()
srv.shutdown()
meta['dsf'] = DSF
(OUT / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
print(json.dumps({k: v for k, v in meta.items() if k != 'strokes'}, ensure_ascii=False)[:1500])
