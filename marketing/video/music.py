"""Musique de fond originale (synthèse) calée sur la voix off : douce au début, plus vivante dès l'apparition de Picaillon."""
import json, pathlib, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile
SR = 48000
TL = json.load(open(pathlib.Path(__file__).resolve().parent / 'voice' / 'timeline.json'))
T = TL['total']
L = {l['id']: l for l in TL['lines']}
N = int(T * SR) + 1
rng = np.random.default_rng(7)
def m2f(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_adsr(n, a, r, sus=1.0):
    e = np.ones(n) * sus; ai = int(a * SR); ri = int(r * SR)
    if ai: e[:ai] = np.linspace(0, sus, ai)
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e
L_out = np.zeros(N); R_out = np.zeros(N)
def add(sig, start, pan=0.0, gain=1.0):
    s = int(start * SR); e = min(N, s + len(sig))
    if e <= s: return
    sig = sig[:e - s] * gain
    L_out[s:e] += sig * np.sqrt(0.5 * (1 - pan)); R_out[s:e] += sig * np.sqrt(0.5 * (1 + pan))

BPM = 96; BEAT = 60 / BPM
t_logo = L['s3']['start'] - 0.15          # « Aujourd'hui… Picaillon »
t_beat = L['s4a']['start'] - 0.1          # le rythme démarre avec le devis
t_end = L['s9c']['end'] + 1.6
# Accords (notes MIDI) et moments
CH = [
    (0.0, [50, 57, 60, 64, 65]),            # Dm9
    (L['s2b']['start'] - 0.3, [46, 53, 57, 62, 65]),  # Bbmaj7
    (t_logo, [41, 53, 57, 60, 67]),         # Fadd9 : arrivée de Picaillon
    (L['s5']['start'] - 0.2, [45, 52, 57, 60, 64]),   # Am7
    (L['s6a']['start'] - 0.2, [46, 53, 57, 62, 65]),  # Bbmaj7
    (L['s7a']['start'] - 0.2, [41, 53, 57, 60, 65]),  # F
    (L['s8']['start'] - 0.2, [43, 55, 58, 62, 65]),   # Gm7
    (L['s9a']['start'] - 0.2, [48, 55, 58, 64, 67]),  # C7
    (L['s9c']['start'] - 0.1, [41, 53, 57, 60, 65, 69]),  # F, résolution
]
bounds = [c[0] for c in CH] + [T]
# Nappe
for k, (st, notes) in enumerate(CH):
    dur = bounds[k + 1] - st + 0.9
    n = int(dur * SR); tt = np.arange(n) / SR
    e = env_adsr(n, 0.6, 0.9)
    for j, m in enumerate(notes[1:]):
        f = m2f(m)
        for det in (-0.004, 0.004):
            ph = rng.uniform(0, 6.28)
            sig = np.sin(2 * np.pi * f * (1 + det) * tt + ph) + 0.25 * np.sin(4 * np.pi * f * tt + ph) + 0.08 * np.sin(6 * np.pi * f * tt)
            trem = 1 + 0.06 * np.sin(2 * np.pi * 0.3 * tt + j)
            add(sig * e * trem, st, pan=(-0.5 if det < 0 else 0.5) * (0.3 + 0.1 * j), gain=0.035)
# Basse
for k, (st, notes) in enumerate(CH):
    if st < t_logo - 0.01: continue
    t0 = st
    while t0 < bounds[k + 1] - 0.05:
        n = int(min(BEAT * 2, bounds[k + 1] - t0) * SR); tt = np.arange(n) / SR
        f = m2f(notes[0] - 12 if notes[0] > 45 else notes[0])
        sig = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 1.2) * env_adsr(n, 0.01, 0.08)
        add(sig, t0, gain=0.16); t0 += BEAT * 2
# Arpège « pincé » (Karplus-Strong)
def pluck(f, dur=1.2, bright=0.5):
    n = int(dur * SR); p = int(SR / f)
    buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.994 + 0.004 * bright)
    return out * np.exp(-np.arange(n) / SR * 1.5)
cache = {}
def pl(m):
    if m not in cache: cache[m] = pluck(m2f(m))
    return cache[m]
pattern = [0, 2, 1, 3, 2, 4, 3, 1]
step = BEAT / 2
t0 = 0.6
while t0 < t_end - 1.0:
    k = max(i for i, c in enumerate(CH) if c[0] <= t0 + 1e-6)
    notes = CH[k][1][1:]
    i = int(round((t0 - 0.6) / step))
    m = notes[pattern[i % len(pattern)] % len(notes)] + 12
    vel = 0.05 if t0 < t_logo else 0.075
    if t0 < t_logo and i % 2: t0 += step; continue   # plus clairsemé pendant l'histoire
    add(pl(m), t0, pan=0.35 if i % 2 else -0.35, gain=vel * (0.8 + 0.4 * rng.random()))
    t0 += step
# Batterie légère
def kick():
    n = int(0.32 * SR); tt = np.arange(n) / SR
    f = 50 + 70 * np.exp(-tt * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
def clap():
    n = int(0.22 * SR); x = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 22)
    return sosfilt(butter(2, [900, 3500], 'bandpass', fs=SR, output='sos'), x)
def hat():
    n = int(0.06 * SR); x = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 70)
    return sosfilt(butter(2, 7000, 'highpass', fs=SR, output='sos'), x)
K, CL, HT = kick(), clap(), hat()
b = 0; t0 = t_beat
stop = L['s9c']['start'] - 0.1
while t0 < stop:
    if b % 4 in (0, 2): add(K, t0, gain=0.42)
    if b % 4 in (1, 3) and t0 > L['s5']['start'] - 0.3: add(CL, t0, gain=0.12, pan=0.1)
    if t0 > L['s6a']['start'] - 0.3:
        add(HT, t0 + BEAT / 2, gain=0.05, pan=0.4)
    b += 1; t0 += BEAT
# Clochettes sur les temps forts
def bell(f, dur=1.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 6)) * np.exp(-tt * 3.2)
for st, base in [(t_logo + 0.05, 77), (L['s6b']['start'] - 0.02, 81), (L['s9b']['start'] - 0.02, 77)]:
    for j, iv in enumerate([0, 4, 7, 12]):
        add(bell(m2f(base + iv)), st + j * 0.07, pan=-0.3 + 0.2 * j, gain=0.06)
# Souffles de transition
def whoosh(dur=0.7):
    n = int(dur * SR); x = rng.standard_normal(n)
    tt = np.linspace(0, 1, n); e = np.sin(np.pi * tt) ** 2
    out = np.zeros(n); seg = 2400
    for s in range(0, n, seg):
        fc = 300 + 5000 * (s / n)
        out[s:s + seg] = sosfilt(butter(2, [fc, min(fc * 2.2, 20000)], 'bandpass', fs=SR, output='sos'), x[s:s + seg])
    return out * e
W = whoosh()
for st in [t_logo - 0.45, L['s5']['start'] - 0.5, L['s7a']['start'] - 0.5, L['s9a']['start'] - 0.5]:
    add(W, st, gain=0.05)
# Réverbération et sortie
ir_n = int(1.8 * SR)
irL = rng.standard_normal(ir_n) * np.exp(-np.linspace(0, 7, ir_n)); irR = rng.standard_normal(ir_n) * np.exp(-np.linspace(0, 7, ir_n))
lp = butter(2, 5000, 'lowpass', fs=SR, output='sos'); irL = sosfilt(lp, irL); irR = sosfilt(lp, irR)
wl = fftconvolve(L_out, irL)[:N]; wr = fftconvolve(R_out, irR)[:N]
wl /= np.abs(wl).max() + 1e-9; wr /= np.abs(wr).max() + 1e-9
peak = max(np.abs(L_out).max(), np.abs(R_out).max()) + 1e-9
L_mix = L_out / peak + 0.22 * wl; R_mix = R_out / peak + 0.22 * wr
# fondu de fin
fade = int(1.5 * SR); end_i = min(N, int(t_end * SR) + int(0.5 * SR))
for ch in (L_mix, R_mix):
    ch[end_i - fade:end_i] *= np.linspace(1, 0, fade); ch[end_i:] = 0
st = np.stack([L_mix, R_mix], 1); st = 0.89 * st / np.abs(st).max()
wavfile.write(str(pathlib.Path(__file__).resolve().parent / 'musique.wav'), SR, (st * 32767).astype(np.int16))
print('musique', round(len(st) / SR, 2), 's')
