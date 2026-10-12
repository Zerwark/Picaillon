# Vidéo verticale de présentation (1080 × 1920)

Animation HTML rendue image par image (Playwright + ffmpeg), musique synthétisée, voix off au choix.

1. `capture.py` : captures de l'app (site construit dans `dist/site`) → `caps/`
2. Voix : `voice.py` (voix robotique espeak-ng + MBROLA) ou `voice_natural.py <speko|elevenlabs> <fichier audio>` (prise naturelle, minutage par ligne)
3. `build_version.sh <nom> video` : musique, mixage, rendu et assemblage → `out/picaillon-video-voix-<nom>.mp4`

Prérequis : Python 3 (numpy, scipy, playwright), Chromium, ffmpeg. Les fichiers audio et vidéo ne sont pas versionnés.
