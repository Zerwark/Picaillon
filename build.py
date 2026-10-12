import pathlib
src = pathlib.Path(__file__).parent / 'src'
css = (src / 'styles.css').read_text()
js = '\n'.join((src / f).read_text() for f in ['core.js', 'qr.js', 'demo.js', 'app.js'])
html = f'''<title>Picaillon</title>
<meta name="description" content="Devis, factures et URSSAF pour micro-entrepreneurs">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500;600;700&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap">
<style>
{css}
</style>
<div id="app"></div>
<script>
{js}
</script>
'''
(pathlib.Path(__file__).parent / 'pecule.html').write_text(html)
print(len(html), 'octets')
