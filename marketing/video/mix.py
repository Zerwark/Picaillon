import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve
sr, v = wavfile.read('voice/voix.wav'); v = v.astype(np.float32) / 32768
sr2, m = wavfile.read('musique.wav'); m = m.astype(np.float32) / 32768
n = max(len(v), len(m)); v = np.pad(v, (0, n - len(v))); m = np.pad(m, ((0, n - len(m)), (0, 0)))
# Version sans voix : la musique seule, un peu plus présente
mo = m * 0.95
wavfile.write('audio-sans-voix.wav', sr, (np.clip(mo, -1, 1) * 32767).astype(np.int16))
# Version avec voix : la musique s'efface sous la voix
envv = np.sqrt(fftconvolve(v ** 2, np.ones(int(0.25 * sr)) / int(0.25 * sr), mode='same').clip(0))
duck = 1 - 0.55 * np.clip(envv / 0.05, 0, 1)
duck = fftconvolve(duck, np.ones(int(0.12 * sr)) / int(0.12 * sr), mode='same')
mix = m * (0.30 * duck)[:, None] + np.stack([v, v], 1) * 0.95
mix = 0.95 * mix / np.abs(mix).max()
wavfile.write('audio-avec-voix.wav', sr, (mix * 32767).astype(np.int16))
print('ok', n / sr)
