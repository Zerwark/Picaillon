"""Rendu d'images clés (test) ou de toute la vidéo vers ffmpeg."""
import sys, json, subprocess, pathlib
from playwright.sync_api import sync_playwright
V = pathlib.Path(__file__).resolve().parent
def run(times=None, out=None, fps=30, audio=None):
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto('file://' + str(V / 'scene.html')); pg.wait_for_load_state('load'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
        if errs: print('ERREURS', errs)
        total = pg.evaluate('window.TL.total')
        if times is not None:
            for t in times:
                pg.evaluate('render(%f)' % t); pg.screenshot(path=str(V / 'test' / ('f_%05.2f.jpg' % t)), type='jpeg', quality=88)
        else:
            n = int(total * fps) + 1
            cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-']
            if audio: cmd += ['-i', str(audio), '-c:a', 'aac', '-b:a', '192k', '-shortest']
            cmd += ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-movflags', '+faststart', str(out)]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            for i in range(n):
                pg.evaluate('render(%f)' % (i / fps))
                proc.stdin.write(pg.screenshot(type='jpeg', quality=95))
                if i % 150 == 0: print('image', i, '/', n, flush=True)
            proc.stdin.close(); proc.wait()
        print('erreurs page :', errs or 'aucune')
        b.close()
if __name__ == '__main__':
    if sys.argv[1] == 'test':
        (V / 'test').mkdir(exist_ok=True)
        run(times=[float(x) for x in sys.argv[2].split(',')])
    else:
        run(out=sys.argv[2], audio=sys.argv[3] if len(sys.argv) > 3 else None)
