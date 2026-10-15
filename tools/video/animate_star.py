"""Re-animate the drone formation as real choreography (LTX can't keep it rigid):
lights are lifted out of frame 0, the sky is inpainted clean, and every light is
re-rendered on an exact path — the star holds, then turns once around its vertical
axis (3D), the two rings chase in opposite directions. Seal/lettering/pole stay in
front. Loop-safe: all motion is periodic in L, tail crossfaded into head.
usage: animate_star.py cfg.json in.mp4 out.mp4"""
import sys, json, subprocess, numpy as np, cv2
cfg = json.load(open(sys.argv[1])); src, out = sys.argv[2], sys.argv[3]
W, H = cfg['W'], cfg['H']
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
V = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
n = len(V); N = 20; L = n - 1 - N
f0 = V[0].copy()
yy, xx = np.mgrid[0:H, 0:W]
rcx, rcy, R = cfg['ring_c'][0], cfg['ring_c'][1], cfg['ring_r']
scx, scy, sr = cfg['seal_c'][0], cfg['seal_c'][1], cfg['seal_r']
roi = (np.hypot(xx - rcx, yy - rcy) < R + 40) & (yy < cfg['sign_top'])
gray = cv2.cvtColor(f0, cv2.COLOR_RGB2GRAY)
th = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
nlab, lab, st, cen = cv2.connectedComponentsWithStats(((th > 35) & roi).astype(np.uint8))
inseal = lambda x, y: np.hypot(x - scx, y - scy) < sr
dots, dotmask, fg = [], np.zeros((H, W), np.uint8), np.zeros((H, W), np.uint8)
for i in range(1, nlab):
    x, y = cen[i]; a = st[i, 4]
    if inseal(x, y):
        continue
    if 2 <= a <= 120 and st[i, 2] <= 14 and st[i, 3] <= 14:
        dots.append((x, y)); dotmask[lab == i] = 1
    elif np.hypot(x - scx, y - scy) < sr * 1.7:          # neon lettering around the seal
        fg[lab == i] = 1
    else:                                                 # touching lights: split at each peak
        comp = (lab == i)
        pk = comp & (th == cv2.dilate(th, np.ones((7, 7), np.uint8))) & (th > 45)
        for py, px in zip(*np.nonzero(pk)):
            dots.append((float(px), float(py)))
        dotmask[comp] = 1
fg = cv2.dilate(fg, np.ones((3, 3), np.uint8))
fg |= (np.hypot(xx - scx, yy - scy) < sr).astype(np.uint8)
px0, px1, py0, py1 = cfg['pole']
fg[py0:py1, px0:px1] = 1
fgf = cv2.GaussianBlur(fg.astype(np.float32), (5, 5), 0)[..., None]
dotmask = cv2.dilate(dotmask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
dd = np.hypot(xx - rcx, yy - rcy)
# Sky behind the formation: normalized convolution of the real sky pixels that sit
# between the lights (far from any light's glow), so the video's own gradient is kept.
far = cv2.dilate(dotmask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (23, 23))) == 0
notfg = cv2.dilate(fg, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))) == 0
valid = (far & notfg & (dd < R + 140)).astype(np.float32)
sky_model = None
for sig in (90, 45, 22):                                  # coarse → fine; fine wins where it has data
    num = cv2.GaussianBlur(f0.astype(np.float32) * valid[..., None], (0, 0), sig)
    den = cv2.GaussianBlur(valid, (0, 0), sig)[..., None]
    est = num / np.maximum(den, 1e-4)
    if sky_model is None:
        sky_model = est
    else:
        w = np.clip(den / 0.15, 0, 1)
        sky_model = est * w + sky_model * (1 - w)
inner = np.clip((R + 40 - dd) / 25, 0, 1)[..., None]
clean = np.clip(f0 * (1 - inner) + sky_model * inner, 0, 255).astype(np.uint8)
cv2.imwrite('clean_plate.png', cv2.cvtColor(clean, cv2.COLOR_RGB2BGR))
# Per-light color = peak above the clean sky.
diff = f0.astype(np.float32) - clean.astype(np.float32)
D = np.array(dots)
cols = np.array([np.clip(diff[int(round(y)), int(round(x))], 0, 255) for x, y in D])
halo = np.clip(cv2.GaussianBlur(diff, (7, 7), 0)[D[:, 1].round().astype(int), D[:, 0].round().astype(int)], 1, 255)
cols = halo / halo.max(1, keepdims=True) * np.maximum(cols.max(1, keepdims=True), 120)
mu = cols.mean(1, keepdims=True); cols = np.clip(mu + (cols - mu) * 1.45, 0, 255)
dist = np.hypot(D[:, 0] - rcx, D[:, 1] - rcy)
ring = dist > cfg['ring_split']
outer = dist > cfg['outer_split']
theta = np.arctan2(D[:, 1] - rcy, D[:, 0] - rcx)
print(f'lights: {len(D)}  star {int((~ring).sum())}  ring {int(ring.sum())}  loop {L}')
rng = np.random.default_rng(3)
ph = rng.uniform(0, 2 * np.pi, len(D)); kk = rng.integers(1, 4, len(D))
# Sprite: tight core + soft halo, matched to the source lights.
S = 10; gy, gx = np.mgrid[-S:S + 1, -S:S + 1]
def sprite(fx, fy):
    r2 = (gx - fx) ** 2 + (gy - fy) ** 2
    return np.exp(-r2 / (2 * 1.25 ** 2)) + 0.22 * np.exp(-r2 / (2 * 3.6 ** 2))
def ease(u):
    return u * u * (3 - 2 * u)
hold = cfg.get('hold', 0.42)
def spin(t):
    u = t / L
    return 0.0 if u < hold else 2 * np.pi * ease((u - hold) / (1 - hold))
mask = (np.clip((R + 70 - np.hypot(xx - rcx, yy - rcy)) / 30, 0, 1) * np.clip((cfg['fade_y1'] - yy) / (cfg['fade_y1'] - cfg['fade_y0']), 0, 1))[..., None]
x0, x1 = int(max(0, rcx - R - 80)), int(min(W, rcx + R + 80)); y0, y1 = 0, int(cfg['fade_y1'])
p = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
cleanf = clean.astype(np.float32)
scx_axis = cfg['star_axis_x']
for t in range(L):
    if t < N:
        a = (t + 1) / (N + 1); fr = a * V[t].astype(np.float32) + (1 - a) * V[L + t].astype(np.float32)
    else:
        fr = V[t].astype(np.float32)
    layer = cleanf[y0:y1, x0:x1] + rng.normal(0, 1.1, (y1 - y0, x1 - x0, 1)).astype(np.float32)
    phi = spin(t)
    tw = 1 + 0.35 * np.sin(2 * np.pi * kk * t / L + ph)
    for j, (x, y) in enumerate(D):
        if ring[j]:
            direction = 1 if outer[j] else -1
            chase = 0.85 + 0.6 * max(0.0, np.cos(theta[j] - direction * 2 * np.pi * 2 * t / L)) ** 4
            nx, ny, b = x, y, chase * tw[j]
        else:
            dx = x - scx_axis
            nx, ny = scx_axis + dx * np.cos(phi), y
            depth = dx * np.sin(phi)                     # toward/away from camera
            b = tw[j] * (0.62 + 0.38 * abs(np.cos(phi))) * (1 + 0.15 * np.tanh(depth / 200))
        ix, iy = int(np.floor(nx)), int(np.floor(ny))
        spr = sprite(nx - ix, ny - iy)[..., None] * cols[j] * b
        ly, lx = iy - y0 - S, ix - x0 - S
        if lx < 0 or ly < 0 or lx + 2 * S + 1 > layer.shape[1] or ly + 2 * S + 1 > layer.shape[0]:
            continue
        layer[ly:ly + 2 * S + 1, lx:lx + 2 * S + 1] += spr
    # Foreground (seal, lettering, pole) stays in front of the drones.
    fgl = fgf[y0:y1, x0:x1]
    layer = layer * (1 - fgl) + f0[y0:y1, x0:x1].astype(np.float32) * fgl
    m = mask[y0:y1, x0:x1]
    fr[y0:y1, x0:x1] = fr[y0:y1, x0:x1] * (1 - m) + np.clip(layer, 0, 255) * m
    p.stdin.write(fr.astype(np.uint8).tobytes())
p.stdin.close(); p.wait(); print('done')
