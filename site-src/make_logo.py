"""Logo Picaillon : même icône que Pécule (P en forme de pièce) + logotype « Picaillon ».
Le point du premier i devient une pièce bleue."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.boundsPen import BoundsPen
import pathlib

OUT = pathlib.Path(__file__).parent
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf'
BLUE, INK, WHITE = '#2340D8', '#141829', '#FFFFFF'
f = TTFont(FONT)
gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f['head'].unitsPerEm
asc, desc = f['hhea'].ascent, -f['hhea'].descent
TRACK = -0.025

# Point du « i » : contour du glyphe i situé au-dessus de la hauteur d'x
rec = RecordingPen(); gs[cmap[ord('i')]].draw(rec)
contours, cur = [], []
for op, args in rec.value:
    cur.append((op, args))
    if op in ('closePath', 'endPath'):
        contours.append(cur); cur = []
def bbox(c):
    pts = [p for op, args in c for p in args]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)
boxes = sorted((bbox(c) for c in contours), key=lambda b: -b[3])
dot = boxes[0]                                      # le plus haut = le point
DOT_CX, DOT_CY = (dot[0] + dot[2]) / 2, (dot[1] + dot[3]) / 2
DOT_R = max(dot[2] - dot[0], dot[3] - dot[1]) / 2

def word(text):
    x, parts, coins = 0, [], []
    for i, ch in enumerate(text):
        if ch == 'i':
            g = cmap[0x131]                            # i sans point
            coins.append((x + DOT_CX, asc - DOT_CY))
        else:
            g = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (1, 0, 0, -1, x, asc)))
        parts.append(pen.getCommands())
        x += gs[g].width + TRACK * upm
    return ' '.join(parts), coins, x - TRACK * upm

D, COINS, W = word('Picaillon')
H = asc + desc
R1 = DOT_R * 1.12                                      # la pièce, un peu plus grosse qu'un point
TOP = min(0, COINS[0][1] - R1 - 10)

def wm(color, coin, dot):
    (x1, y1), (x2, y2) = COINS
    return (f'<path d="{D}" fill="{color}"/>'
            f'<circle cx="{x1:.0f}" cy="{y1:.0f}" r="{R1:.0f}" fill="{coin}"/>'
            f'<circle cx="{x2:.0f}" cy="{y2:.0f}" r="{DOT_R:.0f}" fill="{dot}"/>')

def mark(bg=BLUE, fg=WHITE):
    return (f'<rect width="64" height="64" rx="15" fill="{bg}"/>'
            f'<rect x="16" y="13" width="10.5" height="38" rx="5.25" fill="{fg}"/>'
            f'<circle cx="35" cy="27" r="14" fill="{fg}"/>'
            f'<circle cx="35" cy="27" r="8.4" fill="none" stroke="{bg}" stroke-width="3.2"/>')

(OUT / 'picaillon-icone.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">{mark()}</svg>')

def horizontal(color, coin, bg, fg):
    s = (H * 0.92) / 64
    ox = 64 * s + 0.22 * upm
    icon_y = (H - 64 * s) / 2 + desc * 0.1
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {TOP:.0f} {ox + W:.0f} {H - TOP:.0f}">'
            f'<g transform="translate(0 {icon_y:.0f}) scale({s:.4f})">{mark(bg, fg)}</g>'
            f'<g transform="translate({ox:.0f} 0)">{wm(color, coin, color)}</g></svg>')

(OUT / 'picaillon-logo.svg').write_text(horizontal(INK, BLUE, BLUE, WHITE))
(OUT / 'picaillon-logo-blanc.svg').write_text(horizontal(WHITE, '#8197FF', '#8197FF', '#0D1020'))
app_svg = (f'<svg class="wordmark" viewBox="0 {TOP:.0f} {W:.0f} {H - TOP:.0f}" role="img" aria-label="Picaillon">'
           + wm('currentColor', 'var(--accent)', 'currentColor') + '</svg>')
(OUT / 'wordmark-app.svg').write_text(app_svg)
print('ok', round(W), round(H - TOP), 'point', round(DOT_R), len(app_svg), 'octets')
