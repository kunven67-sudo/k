"""🔊 Sound engine: makes game sound effects and music from math (no sound files or downloads needed).

Sound effects work like the classic game tool "sfxr": a wave + a pitch slide + a volume fade.
Music is a step sequencer: a grid of notes and drums played in a loop.
"""

import math
import random
import shutil
import subprocess
import sys
import wave
from array import array
from pathlib import Path

RATE = 22050
WAVES = ("square", "triangle", "saw", "sine", "noise")

SFX_DEFAULTS = {
    "wave": "square",
    "freq_start": 440.0,      # Hz - where the pitch starts
    "freq_end": 440.0,        # Hz - where it slides to
    "duration": 0.3,          # seconds
    "attack": 0.0,            # seconds to fade in
    "decay": 1.5,             # how fast it fades out (bigger = shorter tail)
    "vibrato_depth": 0.0,     # 0..0.5 wobble amount
    "vibrato_speed": 8.0,     # wobbles per second
    "arp_factor": 1.0,        # jump the pitch by this much...
    "arp_time": 0.5,          # ...at this point (0..1 of the sound) - coins use this
    "duty": 0.5,              # square wave thickness (0.1 = thin/buzzy, 0.5 = round)
    "volume": 0.8,
}

PRESETS = {
    "🔫 Laser": {"wave": "square", "freq_start": 1100, "freq_end": 180, "duration": 0.2, "duty": 0.3, "decay": 1.2},
    "🦘 Jump": {"wave": "square", "freq_start": 260, "freq_end": 700, "duration": 0.22, "duty": 0.4},
    "🪙 Coin": {"wave": "square", "freq_start": 988, "freq_end": 988, "duration": 0.32, "arp_factor": 1.335,
               "arp_time": 0.25, "decay": 2.0},
    "💥 Explosion": {"wave": "noise", "freq_start": 1200, "freq_end": 60, "duration": 0.8, "decay": 2.2,
                    "volume": 0.9},
    "👊 Hit": {"wave": "noise", "freq_start": 2400, "freq_end": 500, "duration": 0.14, "decay": 2.5},
    "⚔️ Sword swoosh": {"wave": "noise", "freq_start": 5000, "freq_end": 900, "duration": 0.28, "attack": 0.06,
                        "decay": 1.8, "volume": 0.55},
    "⭐ Power-up": {"wave": "square", "freq_start": 320, "freq_end": 1000, "duration": 0.5, "vibrato_depth": 0.08,
                   "vibrato_speed": 14, "arp_factor": 1.5, "arp_time": 0.5, "decay": 1.0},
    "🧟 Zombie groan": {"wave": "saw", "freq_start": 120, "freq_end": 70, "duration": 1.0, "attack": 0.18,
                       "vibrato_depth": 0.07, "vibrato_speed": 5, "decay": 0.9, "volume": 0.6},
    "❤️ Heal": {"wave": "triangle", "freq_start": 520, "freq_end": 1040, "duration": 0.45, "vibrato_depth": 0.03,
               "vibrato_speed": 10, "decay": 1.0},
    "🔘 Menu blip": {"wave": "sine", "freq_start": 880, "freq_end": 880, "duration": 0.08, "decay": 2.0},
}


def preset(name):
    return {**SFX_DEFAULTS, **PRESETS[name]}


def mutate(params, amount=0.2, rng=random):
    """🎲 A slightly different version of a sound (each number wiggles by up to ±amount)."""
    new = dict(params)
    for key, value in params.items():
        if isinstance(value, (int, float)) and key not in ("volume",):
            new[key] = max(0.0, value * (1 + rng.uniform(-amount, amount)))
    new["duration"] = min(max(new["duration"], 0.03), 3.0)
    new["duty"] = min(max(new["duty"], 0.05), 0.95)
    return new


def _oscillator(wave_type, phase, duty, state, rng):
    """One sample of a wave. phase goes 0..1."""
    if wave_type == "square":
        return 1.0 if phase < duty else -1.0
    if wave_type == "triangle":
        return 4 * phase - 1 if phase < 0.5 else 3 - 4 * phase
    if wave_type == "saw":
        return 2 * phase - 1
    if wave_type == "sine":
        return math.sin(2 * math.pi * phase)
    return state["noise"]      # noise: a new random value each cycle (lower pitch = rougher noise)


def make_sfx(params, rate=RATE, seed=None):
    """Turn sound settings into samples (floats from -1 to 1)."""
    p = {**SFX_DEFAULTS, **params}
    rng = random.Random(seed)
    n = max(1, int(p["duration"] * rate))
    out = array("f", bytes(4 * n))
    phase, state = 0.0, {"noise": rng.uniform(-1, 1)}
    f0, f1 = max(p["freq_start"], 1.0), max(p["freq_end"], 1.0)
    attack = int(p["attack"] * rate)
    for i in range(n):
        t = i / n                                         # 0..1 through the sound
        freq = f0 * (f1 / f0) ** t                        # smooth pitch slide
        if t >= p["arp_time"]:
            freq *= p["arp_factor"]
        if p["vibrato_depth"]:
            freq *= 1 + p["vibrato_depth"] * math.sin(2 * math.pi * p["vibrato_speed"] * i / rate)
        phase += freq / rate
        if phase >= 1.0:
            phase -= int(phase)
            state["noise"] = rng.uniform(-1, 1)
        env = (i / attack) if i < attack else (1 - t) ** p["decay"]
        out[i] = _oscillator(p["wave"], phase, p["duty"], state, rng) * env * p["volume"]
    return out


# ====================================================================== music
# Spooky A-minor pentatonic, high notes on top (that's how the grid shows them)
NOTE_NAMES = ["D5", "C5", "A4", "G4", "E4", "D4", "C4", "A3"]
NOTE_FREQS = [587.33, 523.25, 440.0, 392.0, 329.63, 293.66, 261.63, 220.0]
DRUMS = ["🥁 Kick", "👏 Snare", "🎩 Hi-hat"]
STEPS = 16


def empty_pattern():
    return {"notes": [[False] * STEPS for _ in NOTE_NAMES], "drums": [[False] * STEPS for _ in DRUMS]}


# Each preset: (row, step) pairs for notes and drums. Row 0 = highest note / kick.
MUSIC_PRESETS = {
    "🌙 Spooky graveyard": {"bpm": 84, "instrument": "triangle",
                           "notes": [(7, 0), (7, 8), (4, 3), (5, 6), (5, 14), (2, 11), (3, 12)],
                           "drums": [(0, 0), (0, 8), (1, 12), (2, 4)]},
    "⚡ Action": {"bpm": 140, "instrument": "square",
                 "notes": [(7, 0), (7, 3), (7, 6), (4, 8), (4, 11), (2, 12), (2, 14), (0, 15)],
                 "drums": [(0, s) for s in (0, 4, 8, 12)] + [(1, 4), (1, 12)] + [(2, s) for s in range(0, 16, 2)]},
    "🌀 Mystery maze": {"bpm": 100, "instrument": "sine",
                       "notes": [(2, 0), (3, 2), (4, 4), (6, 6), (5, 8), (3, 10), (1, 12), (2, 14)],
                       "drums": [(0, 0), (0, 10), (2, 4), (2, 12)]},
}


def preset_pattern(name):
    data = MUSIC_PRESETS[name]
    pattern = empty_pattern()
    for row, step in data["notes"]:
        pattern["notes"][row][step] = True
    for row, step in data["drums"]:
        pattern["drums"][row][step] = True
    return pattern, data["bpm"], data["instrument"]


def _add(buffer, start, samples):
    end = min(len(buffer), start + len(samples))
    for i in range(start, end):
        buffer[i] += samples[i - start]


def _drum(kind, rng):
    if kind == 0:      # kick: a sine that drops in pitch fast
        return make_sfx({"wave": "sine", "freq_start": 150, "freq_end": 40, "duration": 0.22, "decay": 2.5,
                         "volume": 1.0})
    if kind == 1:      # snare: a burst of noise
        return make_sfx({"wave": "noise", "freq_start": 6000, "freq_end": 3000, "duration": 0.16, "decay": 2.2,
                         "volume": 0.6}, seed=rng.random())
    return make_sfx({"wave": "noise", "freq_start": 9000, "freq_end": 9000, "duration": 0.05, "decay": 3.0,
                     "volume": 0.3}, seed=rng.random())    # hi-hat: tiny high noise


def make_music(pattern, bpm=110, instrument="square", bars=4, rate=RATE):
    """Render the grid into samples. bars = how many times the 16 steps repeat (for a longer loop)."""
    step_len = 60.0 / bpm / 4                        # 16th notes
    step_samples = int(step_len * rate)
    total = step_samples * STEPS * bars
    buffer = array("f", bytes(4 * total))
    rng = random.Random(1)
    notes = {}
    for row, freq in enumerate(NOTE_FREQS):
        notes[row] = make_sfx({"wave": instrument, "freq_start": freq, "freq_end": freq,
                               "duration": step_len * 1.8, "attack": 0.005, "decay": 1.3, "volume": 0.35,
                               "duty": 0.4})
    drums = {k: _drum(k, rng) for k in range(len(DRUMS))}
    for bar in range(bars):
        for step in range(STEPS):
            start = (bar * STEPS + step) * step_samples
            for row in range(len(NOTE_NAMES)):
                if pattern["notes"][row][step]:
                    _add(buffer, start, notes[row])
            for row in range(len(DRUMS)):
                if pattern["drums"][row][step]:
                    _add(buffer, start, drums[row])
    return buffer


# ====================================================================== files + playing
def write_wav(path, samples, rate=RATE):
    """Save samples as a 16-bit .wav file (loudness evened out so it's never too quiet or crunchy)."""
    peak = max((abs(s) for s in samples), default=0) or 1.0
    scale = 0.9 / peak if peak > 0.9 or peak < 0.3 else 1.0
    data = array("h", (int(max(-1.0, min(1.0, s * scale)) * 32767) for s in samples))
    if sys.byteorder == "big":
        data.byteswap()
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data.tobytes())
    return path


_player = None


def play_wav(path):
    """Play a .wav without waiting (Windows has this built in)."""
    global _player
    stop()
    if sys.platform == "win32":
        import winsound
        winsound.PlaySound(str(path), winsound.SND_FILENAME | winsound.SND_ASYNC)
        return True
    for exe in ("afplay", "paplay", "aplay"):
        if shutil.which(exe):
            _player = subprocess.Popen([exe, str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
    return False


def stop():
    global _player
    if sys.platform == "win32":
        import winsound
        winsound.PlaySound(None, 0)
    elif _player and _player.poll() is None:
        _player.kill()
    _player = None
