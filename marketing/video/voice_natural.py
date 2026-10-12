"""Voix off naturelle (Speko ou ElevenLabs) : on garde la prise telle quelle et on en déduit le minutage de chaque phrase.

Usage : python3 voice_natural.py <nom> <fichier audio>
Les repères (début du premier mot, fin du dernier mot de chaque ligne) viennent d'une transcription
avec horodatage des mots ; on les affine ensuite sur les silences réels de l'enregistrement.
"""
import sys, json, subprocess, pathlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

V = pathlib.Path(__file__).resolve().parent
SR = 48000
LEAD = 0.45   # silence avant la première phrase
TAIL = 2.2    # le logo et l'adresse restent à l'écran après la dernière phrase
CAPS = [
    ('s1', "Camille est peintre en bâtiment."),
    ('s2a', "Le soir, après ses chantiers, elle faisait ses factures à la main…"),
    ('s2b', "sans jamais savoir ce qu'il lui restait vraiment."),
    ('s3', "Aujourd'hui, elle utilise Picaillon."),
    ('s4a', "Son devis est prêt en deux minutes,"),
    ('s4b', "et son client le signe sur place, du bout du doigt."),
    ('s5', "En un geste, il devient une facture, avec toutes les mentions obligatoires."),
    ('s6a', "Le client scanne le QR code…"),
    ('s6b', "et c'est payé."),
    ('s7a', "Picaillon calcule ses cotisations URSSAF, lui rappelle quand déclarer,"),
    ('s7b', "et lui montre son vrai net en poche."),
    ('s8', "Pas de compte, pas de publicité : tout reste sur son téléphone."),
    ('s9a', "Vous aussi, essayez Picaillon."),
    ('s9b', "C'est gratuit."),
    ('s9c', "Le lien est juste en dessous."),
]
# Repères issus de la transcription (ms) : (début du premier mot, fin du dernier mot) pour chaque ligne
MARKS = {
    'speko': [(0, 1200), (1900, 5300), (5600, 7400), (8300, 10200), (10700, 12400), (12500, 15100), (15900, 19800),
              (20300, 22000), (22300, 22900), (23900, 27800), (28000, 30000), (30600, 34100), (34600, 36400),
              (37100, 37700), (38200, 39700)],
    'elevenlabs': [(200, 1800), (2800, 6800), (6800, 9200), (10000, 11900), (12500, 14400), (14500, 17100), (17600, 21600),
                   (22100, 23800), (24000, 24700), (25300, 29100), (29200, 31200), (31600, 35200), (35800, 37700),
                   (37900, 38600), (38800, 40100)],
}

name, src = sys.argv[1], sys.argv[2]
out_dir = V / 'voice' / name; out_dir.mkdir(parents=True, exist_ok=True)
tmp = out_dir / 'source-48k.wav'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-c:a', 'pcm_f32le', str(tmp)], check=True)
sr, a = wavfile.read(tmp); a = a.astype(np.float32)
a = sosfilt(butter(2, 70, 'highpass', fs=SR, output='sos'), a).astype(np.float32)
a = 0.89 * a / (np.abs(a).max() + 1e-9)

# Énergie par trames de 10 ms
hop = SR // 100
nfr = len(a) // hop
rms = np.sqrt(np.mean(a[:nfr * hop].reshape(nfr, hop) ** 2, axis=1) + 1e-12)
db = 20 * np.log10(rms / rms.max())
THR = -42.0
loud = db > THR

def first_loud(t0, t1):
    i0, i1 = int(t0 * 100), min(nfr, int(t1 * 100))
    idx = np.where(loud[i0:i1])[0]
    return (i0 + idx[0]) / 100 if len(idx) else t0

def last_loud(t0, t1):
    i0, i1 = max(0, int(t0 * 100)), min(nfr, int(t1 * 100))
    idx = np.where(loud[i0:i1])[0]
    return (i0 + idx[-1] + 1) / 100 if len(idx) else t1

marks = [(s / 1000, e / 1000) for s, e in MARKS[name]]
starts, ends = [], []
for k, (s, e) in enumerate(marks):
    starts.append(s); ends.append(e)
# Affinage sur chaque frontière : le plus long silence entre la fin d'une ligne et le début de la suivante
for k in range(len(marks) - 1):
    lo, hi = ends[k] - 0.15, starts[k + 1] + 0.15
    i0, i1 = max(0, int(lo * 100)), min(nfr, int(hi * 100))
    best, run, best_span = None, None, (0, 0)
    for i in range(i0, i1):
        if not loud[i]:
            run = i if run is None else run
            if i - run + 1 > best_span[1] - best_span[0]: best_span = (run, i + 1)
        else:
            run = None
    if best_span[1] > best_span[0]:
        ends[k], starts[k + 1] = best_span[0] / 100, best_span[1] / 100
    else:   # pas de vrai silence : on coupe au creux d'énergie
        m = i0 + int(np.argmin(db[i0:i1])); ends[k] = starts[k + 1] = m / 100
starts[0] = first_loud(max(0, marks[0][0] - 0.4), marks[0][1])
ends[-1] = last_loud(marks[-1][0], marks[-1][1] + 0.6)

# Placement : la prise est gardée intacte, décalée de LEAD
off = LEAD - starts[0]
a = a[max(0, int((starts[0] - 0.06) * SR)): int((ends[-1] + 0.35) * SR)]
pre = int((LEAD - 0.06) * SR)
total = ends[-1] + off + TAIL
voice = np.zeros(int(total * SR) + 1, dtype=np.float32)
voice[pre: pre + len(a)] = a[: len(voice) - pre]
# Fondu très court aux bords
f = int(0.03 * SR); voice[pre:pre + f] *= np.linspace(0, 1, f)
timeline = [{'id': i, 'start': round(s + off, 3), 'end': round(e + off, 3), 'caption': c} for (i, c), s, e in zip(CAPS, starts, ends)]
wavfile.write(str(out_dir / 'voix.wav'), SR, (voice * 32767).astype(np.int16))
json.dump({'total': round(total, 3), 'lines': timeline}, open(out_dir / 'timeline.json', 'w'), ensure_ascii=False, indent=1)
print(name, 'durée totale', round(total, 2), 's')
for l in timeline: print(' ', l['id'], l['start'], l['end'], round(l['end'] - l['start'], 2), l['caption'][:40])
