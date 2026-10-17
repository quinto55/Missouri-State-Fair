"""Missouri version: rings kept, star replaced by the state outline + Sedalia star.
Re-animate the drone formation as real choreography (LTX can't keep it rigid):
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
# Texas read: the lone star in a circle looked like the Texas Lone Star, so the star
# lights are retired and drones redraw the Missouri outline with a gold star on Sedalia.
import re
html = open(cfg.get('outline_src', 'index.html')).read()
path = re.search(r'class="foot-map".*?d="([^"]+)"', html, re.S).group(1)
P = np.array([[float(a), float(b)] for a, b in re.findall(r'([\d.]+) ([\d.]+)', path)])
P = np.vstack([P, P[:1]])
seg = np.hypot(*np.diff(P, axis=0).T); cum = np.r_[0, np.cumsum(seg)]
mw = cfg['mo_w']; mcx, mcy = cfg['mo_c']
sc = mw / (P[:, 0].max() - P[:, 0].min())
ox = mcx - sc * (P[:, 0].min() + P[:, 0].max()) / 2; oy = mcy - sc * (P[:, 1].min() + P[:, 1].max()) / 2
npts = int(cum[-1] * sc / cfg.get('mo_step', 11))
s = np.linspace(0, cum[-1], npts, endpoint=False)
MO = np.c_[np.interp(s, cum, P[:, 0]), np.interp(s, cum, P[:, 1])] * sc + [ox, oy]
mo_u = s / cum[-1]                                         # position along the border, 0..1
# Sedalia star (same point as the footer map star)
sx, sy = 0.3827 * sc + ox, 0.3647 * sc + oy
k = cfg.get('star_r', 22)
ang = -np.pi / 2 + np.arange(10) * np.pi / 5
tips = np.c_[sx + np.where(np.arange(10) % 2 == 0, k, k * 0.42) * np.cos(ang), sy + np.where(np.arange(10) % 2 == 0, k, k * 0.42) * np.sin(ang)]
ST = [tips[i] + (tips[(i + 1) % 10] - tips[i]) * f for i in range(10) for f in (0, 0.5)] + [(sx, sy)]
ST = np.array(ST)
star_cols = cols[~ring]
warm = star_cols[star_cols[:, 0] > star_cols[:, 2] * 1.15]; cool = star_cols[star_cols[:, 2] >= star_cols[:, 0]]
gold = np.clip(warm.mean(0) * 1.15, 0, 255) if len(warm) else np.array([255, 200, 110.])
white = np.clip(cool.mean(0), 0, 255) if len(cool) else np.array([225, 232, 255.])
print(f'outline {len(MO)}  sedalia {len(ST)}')
# Keep only the ring lights from the source (minus old star tips that reached the ring:
# those are gold, the rings are red/blue); add the new formation.
ring = ring & ~((cols[:, 1] > 0.6 * cols.max(1)) & (cols[:, 0] > cols[:, 2] * 1.1))
D = np.vstack([D[ring], MO, ST]); cols = np.vstack([cols[ring], np.tile(np.clip(white * 1.5, 0, 255), (len(MO), 1)), np.tile(gold, (len(ST), 1))])
theta = np.r_[theta[ring], np.zeros(len(MO) + len(ST))]
outer = np.r_[outer[ring], np.zeros(len(MO) + len(ST), bool)]
kind = np.r_[np.zeros(int(ring.sum()), int), np.ones(len(MO), int), np.full(len(ST), 2)]
uu = np.r_[np.zeros(int(ring.sum())), mo_u, np.zeros(len(ST))]
rng = np.random.default_rng(3)
ph = rng.uniform(0, 2 * np.pi, len(D)); kk = rng.integers(1, 4, len(D))
S = 10; gy, gx = np.mgrid[-S:S + 1, -S:S + 1]
def sprite(fx, fy):
    r2 = (gx - fx) ** 2 + (gy - fy) ** 2
    return np.exp(-r2 / (2 * 1.25 ** 2)) + 0.22 * np.exp(-r2 / (2 * 3.6 ** 2))
mask = (np.clip((R + 70 - np.hypot(xx - rcx, yy - rcy)) / 30, 0, 1) * np.clip((cfg['fade_y1'] - yy) / (cfg['fade_y1'] - cfg['fade_y0']), 0, 1))[..., None]
x0, x1 = int(max(0, rcx - R - 80)), int(min(W, rcx + R + 80)); y0, y1 = 0, int(cfg['fade_y1'])
p = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
cleanf = clean.astype(np.float32)
for t in range(L):
    if t < N:
        a = (t + 1) / (N + 1); fr = a * V[t].astype(np.float32) + (1 - a) * V[L + t].astype(np.float32)
    else:
        fr = V[t].astype(np.float32)
    layer = cleanf[y0:y1, x0:x1] + rng.normal(0, 1.1, (y1 - y0, x1 - x0, 1)).astype(np.float32)
    tw = 1 + 0.25 * np.sin(2 * np.pi * kk * t / L + ph)
    # Two comets of light run around the state line; the Sedalia star breathes.
    pulse = 1 + 0.35 * (0.5 - 0.5 * np.cos(2 * np.pi * 2 * t / L))
    for j, (x, y) in enumerate(D):
        if kind[j] == 0:
            direction = 1 if outer[j] else -1
            chase = 0.85 + 0.6 * max(0.0, np.cos(theta[j] - direction * 2 * np.pi * 2 * t / L)) ** 4
            b = chase * tw[j]
        elif kind[j] == 1:
            d = (uu[j] - 2 * t / L) % 0.5 / 0.5             # 0..1 distance behind the comet head
            b = tw[j] * (0.9 + 0.9 * np.exp(-d * 9) + 0.9 * np.exp(-(1 - d) * 60))
        else:
            b = 1.25 * pulse
        ix, iy = int(np.floor(x)), int(np.floor(y))
        spr = sprite(x - ix, y - iy)[..., None] * cols[j] * b
        ly, lx = iy - y0 - S, ix - x0 - S
        if lx < 0 or ly < 0 or lx + 2 * S + 1 > layer.shape[1] or ly + 2 * S + 1 > layer.shape[0]:
            continue
        layer[ly:ly + 2 * S + 1, lx:lx + 2 * S + 1] += spr
    fgl = fgf[y0:y1, x0:x1]
    layer = layer * (1 - fgl) + f0[y0:y1, x0:x1].astype(np.float32) * fgl
    m = mask[y0:y1, x0:x1]
    fr[y0:y1, x0:x1] = fr[y0:y1, x0:x1] * (1 - m) + np.clip(layer, 0, 255) * m
    p.stdin.write(fr.astype(np.uint8).tobytes())
p.stdin.close(); p.wait(); print('done')
