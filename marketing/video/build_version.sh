#!/bin/bash
# Usage : build_version.sh <nom de voix> [video]  — prépare l'audio (et la vidéo si « video »)
set -e
cd "$(dirname "$0")"
N=$1
cp voice/$N/voix.wav voice/voix.wav
cp voice/$N/timeline.json voice/timeline.json
python3 music.py
python3 mkdata.py
python3 mix.py
ffmpeg -y -loglevel error -i audio-avec-voix.wav -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 voice/$N/audio-norm.wav
cp musique.wav voice/$N/musique.wav
if [ "$2" = "video" ]; then
  python3 frames.py full out/video-muette-$N.mp4
  ffmpeg -y -loglevel error -i out/video-muette-$N.mp4 -i voice/$N/audio-norm.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out/picaillon-video-voix-$N.mp4
  ls -la out/picaillon-video-voix-$N.mp4
fi
