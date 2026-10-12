"""Voix off robotique (espeak-ng + MBROLA fr4), phrase par phrase, avec la durée de chacune."""
import json, subprocess, wave, pathlib, os
import numpy as np
from scipy.signal import resample_poly, butter, sosfilt
D = pathlib.Path(__file__).resolve().parent / 'voice'; F = D / 'frag'; F.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, PATH='/home/claude/tts/bin:' + os.environ['PATH'])
SR = 48000
# (id, texte dit, sous-titre, vitesse, hauteur, pause après en s)
LINES = [
    ('s1', "Camille est peintre en bâtiment.", "Camille est peintre en bâtiment.", 128, 52, 0.55),
    ('s2a', "Le soir, après ses chantiers, elle faisait ses factures à la main,", "Le soir, après ses chantiers, elle faisait ses factures à la main…", 132, 48, 0.35),
    ('s2b', "sans jamais savoir ce qu'il lui restait vraiment.", "sans jamais savoir ce qu'il lui restait vraiment.", 128, 46, 0.6),
    ('s3', "Aujourd'hui, elle utilise Picaillon.", "Aujourd'hui, elle utilise Picaillon.", 130, 56, 0.6),
    ('s4a', "Son devis est prêt en deux minutes,", "Son devis est prêt en deux minutes,", 136, 52, 0.2),
    ('s4b', "et son client le signe sur place, du bout du doigt.", "et son client le signe sur place, du bout du doigt.", 136, 50, 0.5),
    ('s5', "En un geste, il devient une facture, avec toutes les mentions obligatoires.", "En un geste, il devient une facture, avec toutes les mentions obligatoires.", 138, 50, 0.5),
    ('s6a', "Le client scanne le QR code,", "Le client scanne le QR code…", 132, 52, 0.35),
    ('s6b', "et c'est payé.", "et c'est payé.", 125, 58, 0.6),
    ('s7a', "Picaillon calcule ses cotisations Urssaf, lui rappelle quand déclarer,", "Picaillon calcule ses cotisations URSSAF, lui rappelle quand déclarer,", 138, 50, 0.2),
    ('s7b', "et lui montre son vrai net en poche.", "et lui montre son vrai net en poche.", 130, 54, 0.6),
    ('s8', "Pas de compte, pas de publicité : tout reste sur son téléphone.", "Pas de compte, pas de publicité : tout reste sur son téléphone.", 136, 50, 0.65),
    ('s9a', "Vous aussi, essayez Picaillon.", "Vous aussi, essayez Picaillon.", 130, 56, 0.3),
    ('s9b', "C'est gratuit.", "C'est gratuit.", 128, 58, 0.3),
    ('s9c', "Le lien est juste en dessous.", "Le lien est juste en dessous.", 130, 52, 0.0),
]
LEAD = 0.45   # silence avant la première phrase
def synth(i, text, speed, pitch):
    out = F / (i + '.wav')
    subprocess.run(['espeak-ng', '-v', 'mb-fr4', '-s', str(speed), '-p', str(pitch), '-a', '70', '-w', str(out), text], env=env, check=True, capture_output=True)
    w = wave.open(str(out)); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768; sr = w.getframerate()
    a = resample_poly(a, SR, sr).astype(np.float32)
    # On retire les silences de début et de fin pour maîtriser les pauses
    idx = np.where(np.abs(a) > 0.01)[0]
    if len(idx): a = a[max(0, idx[0] - 240): idx[-1] + 2400]
    return a
segs, t, timeline = [], LEAD, []
for i, text, cap, sp, pi, pause in LINES:
    a = synth(i, text, sp, pi)
    timeline.append({'id': i, 'start': round(t, 3), 'end': round(t + len(a) / SR, 3), 'caption': cap})
    segs.append((t, a)); t += len(a) / SR + pause
total = t + 2.2   # fin : le logo et l'adresse restent à l'écran
voice = np.zeros(int(total * SR) + 1, dtype=np.float32)
for st, a in segs:
    s = int(st * SR); voice[s:s + len(a)] += a
# Habillage : coupe des graves, présence, léger écho de pièce, compression douce
voice = sosfilt(butter(2, 110, 'highpass', fs=SR, output='sos'), voice)
pres = sosfilt(butter(2, [2500, 5000], 'bandpass', fs=SR, output='sos'), voice)
voice = voice + 0.25 * pres
ir_len = int(0.35 * SR); rng = np.random.default_rng(3)
ir = rng.standard_normal(ir_len).astype(np.float32) * np.exp(-np.linspace(0, 9, ir_len)).astype(np.float32)
ir = sosfilt(butter(2, 4000, 'lowpass', fs=SR, output='sos'), ir)
from scipy.signal import fftconvolve
wet = fftconvolve(voice, ir)[:len(voice)]; wet /= (np.abs(wet).max() + 1e-9)
voice = voice / (np.abs(voice).max() + 1e-9) + 0.06 * wet
env_ = np.abs(voice); thr = 0.35
gain = np.where(env_ > thr, (thr + (env_ - thr) / 3) / np.maximum(env_, 1e-9), 1.0)
gain = np.convolve(gain, np.ones(240) / 240, mode='same')
voice = voice * gain
voice = 0.89 * voice / (np.abs(voice).max() + 1e-9)
from scipy.io import wavfile
wavfile.write(str(D / 'voix.wav'), SR, (voice * 32767).astype(np.int16))
json.dump({'total': round(total, 3), 'lines': timeline}, open(D / 'timeline.json', 'w'), ensure_ascii=False, indent=1)
print('durée totale', round(total, 2), 's')
for l in timeline: print(l['id'], l['start'], l['end'], l['caption'][:50])
