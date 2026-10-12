import json, pathlib
V = pathlib.Path(__file__).resolve().parent
tl = json.load(open(V / 'voice/timeline.json'))
meta = json.load(open(V / 'caps/meta.json'))
wm = (V.parent / 'logo' / 'wordmark-app.svg').read_text()
(V / 'data.js').write_text('window.TL=%s;\nwindow.META=%s;\nwindow.WM=%s;\n' % (json.dumps(tl, ensure_ascii=False), json.dumps(meta), json.dumps(wm)))
print('data.js ok')
