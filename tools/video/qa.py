import sys, subprocess, glob, os
from PIL import Image, ImageChops, ImageStat
vid, tag, sx0, sy0, sx1, sy1, wx0, wy0, wx1, wy1 = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:11])
d = f'fr_{tag}'; os.makedirs(d, exist_ok=True)
for f in glob.glob(d + '/*'): os.remove(f)
subprocess.run(['ffmpeg','-loglevel','error','-i',vid,'-vf',"select='not(mod(n\\,24))+eq(n\\,240)'",'-vsync','0',f'{d}/f%02d.png'],check=True)
fs = sorted(glob.glob(d + '/*.png')); ims = [Image.open(f).convert('RGB') for f in fs]
g = [i.convert('L') for i in ims]
D = lambda a, b: round(ImageStat.Stat(ImageChops.difference(a, b)).mean[0], 2)
star = (sx0, sy0, sx1, sy1); wheel = (wx0, wy0, wx1, wy1)
print(tag, 'star drift vs f0:', [D(g[0].crop(star), x.crop(star)) for x in g])
print(tag, 'wheel motion:', [D(g[i].crop(wheel), g[i+1].crop(wheel)) for i in range(len(g)-1)])
print(tag, 'seam last->first:', D(g[-1], g[0]))
W = sx1 - sx0; H = sy1 - sy0
sheet = Image.new('RGB', (W * 4 + 30, H))
for k, idx in enumerate([0, 3, 5, 8]): sheet.paste(ims[idx].crop(star), (k * (W + 10), 0))
sheet.thumbnail((2000, 2000)); sheet.save(f'star_{tag}.jpg', quality=85)
