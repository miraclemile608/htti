"""Rebuild the two CC0 derivatives; see assets/audio/README.md for source archives.

Usage: python tools/prepare-audio.py <archive-directory> [ffmpeg-executable]
Requires NumPy and SciPy; ffmpeg may be on PATH or supplied explicitly.
"""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly, sosfilt
from scipy.signal import butter

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
ARCHIVES = {
    'ambience.zip': 'b08345334b3178e6d340328787f7edefef8fde6545c86e8487a18d567e31671f',
    'hits.zip': '4bbdba64225d2ad2f5d23a04d71ccb18e6567c42f972a7f2dcb66d8acc5ed4f3',
}


def read_wav(archive, suffix):
    with zipfile.ZipFile(archive) as z:
        member = next(n for n in z.namelist() if n.endswith(suffix))
        rate, data = wavfile.read(io.BytesIO(z.read(member)))
    divisor = float(2 ** (data.dtype.itemsize * 8 - 1)) if data.dtype.kind == 'i' else 1
    data = data.astype(np.float64) / divisor
    if data.ndim == 1:
        data = np.repeat(data[:, None], 2, axis=1)
    return resample_poly(data, RATE, rate, axis=0)


def band(data, cutoff, kind):
    return sosfilt(butter(2, cutoff, fs=RATE, btype=kind, output='sos'), data, axis=0)


def hit_slice(data):
    # Remove leading silence, leaving 2 ms ahead of the first substantial transient.
    envelope = np.max(np.abs(data), axis=1)
    onset = max(0, int(np.flatnonzero(envelope > envelope.max() * .12)[0]) - 88)
    segment = data[onset:onset + int(.62 * RATE)].copy()
    segment = np.pad(segment, ((0, max(0, int(.62 * RATE) - len(segment))), (0, 0)))
    return segment / max(np.sqrt(np.mean(segment[:int(.3 * RATE)] ** 2)), 1e-6)


def main():
    source = Path(sys.argv[1])
    encoder = sys.argv[2] if len(sys.argv) > 2 else 'ffmpeg'
    for name, sha in ARCHIVES.items():
        if hashlib.sha256((source / name).read_bytes()).hexdigest() != sha:
            raise ValueError('Source archive checksum differs: ' + name)

    bed = band(read_wav(source / 'ambience.zip', 'ambient_horror_track01.wav'), 35, 'highpass')
    # Circular crossfade: end -> start is continuous without a fade-to-silence gap.
    n = int(.75 * RATE)
    weight = np.linspace(0, 1, n)[:, None]
    seam = bed[-n:] * (1 - weight) + bed[:n] * weight
    bed = np.concatenate([bed[n:-n], seam])
    bed *= min(.15 / np.sqrt(np.mean(bed ** 2)), .84 / np.max(np.abs(bed)))

    mid = hit_slice(read_wav(source / 'hits.zip', '/Mid/Mid 7.wav'))
    high = hit_slice(read_wav(source / 'hits.zip', '/High/High 6.wav'))
    bass = hit_slice(read_wav(source / 'hits.zip', '/Bassy/Bassy 5.wav'))
    sting = band(mid * .55 + high * .32 + bass * .26, 50, 'highpass')
    sting = band(sting, 7500, 'lowpass')
    t = np.arange(len(sting)) / RATE
    envelope = np.minimum(t / .003, 1) * np.exp(-t * 2.6) * np.minimum((.62 - t) / .12, 1)
    sting = np.tanh(sting * .75) * envelope[:, None]
    sting *= .89 / np.max(np.abs(sting))

    output = ROOT / 'assets/audio'
    output.mkdir(parents=True, exist_ok=True)
    report = {}
    with tempfile.TemporaryDirectory(prefix='htti-audio-') as temp:
        for name, data, bitrate in [('dread-loop', bed, '160k'), ('jumpscare', sting, '192k')]:
            wav = Path(temp) / (name + '.wav')
            wavfile.write(wav, RATE, (data * 32767).astype(np.int16))
            dest = output / (name + '.mp3')
            subprocess.run([encoder, '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', bitrate, '-map_metadata', '-1', str(dest)], check=True)
            report[name] = {'seconds': len(data) / RATE, 'pcm_peak_dbfs': round(20 * np.log10(np.max(abs(data))), 2), 'pcm_rms_dbfs': round(20 * np.log10(np.sqrt(np.mean(data ** 2))), 2), 'bytes': dest.stat().st_size, 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
