"""Render original, deterministic instrumental loops. Requires numpy and ffmpeg.
No external recordings or samples are used; outputs are served by the app itself.
"""
from pathlib import Path
import subprocess
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'public' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
RATE = 32000
THEMES = [
    ('tavern', 80, [50, 55, 57, 53], [0, 7, 12, 16, 12, 7, 19, 16]),
    ('common-room', 88, [48, 53, 55, 48], [0, 4, 7, 12, 7, 4, 14, 12]),
    ('dungeon', 64, [38, 41, 36, 38], [0, 7, 12, 15, 12, 7, 10, 7]),
    ('battle', 104, [38, 41, 43, 36], [0, 7, 12, 7, 15, 12, 7, 10]),
    ('arcane', 72, [45, 48, 43, 41], [0, 7, 12, 15, 19, 15, 12, 7]),
    ('cards', 90, [48, 45, 53, 55], [0, 4, 7, 12, 16, 12, 7, 4]),
    ('chess', 68, [48, 53, 45, 55], [0, 7, 12, 16, 19, 16, 12, 7]),
    ('challenge', 96, [45, 41, 48, 43], [0, 7, 12, 15, 12, 19, 15, 7]),
]
for name, bpm, roots, pattern in THEMES:
    beat = 60 / bpm
    seconds = 64 * beat
    length = round(seconds * RATE)
    mix = np.zeros((length, 2), dtype=np.float64)
    def note(start, duration, midi, gain, pan=0, pad=False):
        t = np.arange(round(duration * RATE)) / RATE
        f = 440 * 2 ** ((midi - 69) / 12)
        wave = np.sin(2*np.pi*f*t) + .22*np.sin(2*np.pi*f*2*t) + .07*np.sin(2*np.pi*f*3*t)
        if pad:
            env = np.minimum(t/.45, 1) * np.minimum((duration-t)/.7, 1)
        else:
            env = (1-np.exp(-t*85))*np.exp(-t*3.2/duration)*np.minimum((duration-t)/.08, 1)
        signal = wave * env * gain
        index = (round(start*RATE) + np.arange(len(t))) % length
        for channel, level in enumerate([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)]):
            np.add.at(mix[:, channel], index, signal*level)
    for bar in range(16):
        root = roots[(bar//2) % 4]
        minor = name in ('dungeon', 'battle', 'arcane', 'challenge')
        for interval in [0, 7, 15 if minor else 16]:
            note(bar*4*beat, 4*beat+.7, root+interval, .035, (interval-7)/20, True)
        note(bar*4*beat, 2*beat, root-12, .11)
        note((bar*4+2)*beat, 1.7*beat, root-5, .07)
        for step in range(8):
            pitch = root + 12 + pattern[(step+bar%2*2)%8]
            note((bar*4+step/2)*beat, beat*1.3, pitch, .07 if step%2 else .10, .3 if step%2 else -.3)
    # Circular stereo echoes make the file boundary continuous, with no dead tail.
    dry = mix.copy()
    for delay, gain in [(beat*.75,.18), (beat*1.5,.09)]:
        mix += np.roll(dry[:, ::-1], round(delay*RATE), axis=0)*gain
    mix *= .72 / max(1, np.abs(mix).max())
    pcm = (np.clip(mix,-1,1)*32767).astype('<i2')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','s16le','-ar',str(RATE),'-ac','2','-i','pipe:0','-codec:a','libmp3lame','-b:a','96k',str(OUT/(name+'.mp3'))],input=pcm.tobytes(),check=True)
    print(name, round(seconds,1), 'seconds')
