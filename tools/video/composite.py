"""Freeze the drone star (LTX keeps spinning it), give each drone light its own
looping twinkle, and crossfade the tail into the head for a seamless loop.
usage: composite.py in.mp4 out_master.mp4 W H cx cy r fade_y0 fade_y1"""
import sys, subprocess, numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
W, H, cx, cy, R, fy0, fy1 = map(int, sys.argv[3:10])
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
V = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
del raw
n = len(V); N = 20; L = n - 1 - N  # drop the duplicate end frame (it equals the start condition)
print('frames', n, 'loop length', L)
# Mask: disc around the drone ring, feathered, faded out above the arch sign.
yy, xx = np.mgrid[0:H, 0:W]
dist = np.hypot(xx - cx, yy - cy)
m = np.clip((R + 30 - dist) / 30, 0, 1) * np.clip((fy1 - yy) / max(1, fy1 - fy0), 0, 1)
m = m[..., None]
base = V[0].astype(np.float32)
lum = base.mean(2)
blur = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))).astype(np.float32)
small = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
hi = np.clip(base - np.asarray(Image.fromarray(base.astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32), 0, 255)
sky = (blur < 75).astype(np.float32)[..., None]          # lights against dark sky only (not the seal)
rng = np.random.default_rng(7)
cell = 9
ph = rng.uniform(0, 2 * np.pi, (H // cell + 1, W // cell + 1))
k = rng.integers(1, 4, (H // cell + 1, W // cell + 1))
PH = np.kron(ph, np.ones((cell, cell)))[:H, :W]; K = np.kron(k, np.ones((cell, cell)))[:H, :W]
def star(t):
    f = 1 + 0.55 * np.sin(2 * np.pi * K * t / L + PH) + 0.12 * np.sin(2 * np.pi * t / L)
    return np.clip(base + hi * sky * (f[..., None] - 1), 0, 255)
p = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
for i in range(L):
    if i < N:
        a = (i + 1) / (N + 1)
        fr = a * V[i].astype(np.float32) + (1 - a) * V[L + i].astype(np.float32)
    else:
        fr = V[i].astype(np.float32)
    fr = fr * (1 - m) + star(i) * m
    p.stdin.write(fr.astype(np.uint8).tobytes())
p.stdin.close(); p.wait()
# seam check: last output frame vs first
print('done')
