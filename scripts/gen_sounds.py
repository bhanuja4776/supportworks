"""Generate the bundled alarm sounds (pure stdlib — 16-bit mono WAV)."""
import math
import os
import struct
import wave

SR = 44100
OUT = "/app/frontend/assets/sounds"
os.makedirs(OUT, exist_ok=True)


def write(name, samples):
    path = os.path.join(OUT, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples))
    print("wrote", path, os.path.getsize(path), "bytes")


def tone(freq, dur, vol=0.6, decay=4.0):
    n = int(SR * dur)
    return [vol * math.exp(-decay * i / n) * math.sin(2 * math.pi * freq * i / SR) for i in range(n)]


def silence(dur):
    return [0.0] * int(SR * dur)


# Chime: pleasant two-tone (E6 -> C6)
write("chime.wav", tone(1318.5, 0.35, 0.55, 3.0) + tone(1046.5, 0.6, 0.5, 3.5))

# Bell: single strike with harmonics, long decay
n = int(SR * 1.4)
bell = [
    0.55 * math.exp(-3.2 * i / n)
    * (math.sin(2 * math.pi * 880 * i / SR) + 0.5 * math.sin(2 * math.pi * 1760 * i / SR) + 0.25 * math.sin(2 * math.pi * 2637 * i / SR))
    / 1.75
    for i in range(n)
]
write("bell.wav", bell)

# Pulse: three short urgent beeps
write("pulse.wav", (tone(988, 0.13, 0.6, 1.2) + silence(0.09)) * 3)
