#!/usr/bin/env python3
"""Brand assets from the original logo (brand/logo-original.png = LL_dancestudie_logo-03.png from lldancestudio.dk):
public/brand/{logo,logo-white,mark,mark-white}.png, PWA icons, resources/icon*.png + splash.png (white background like the
original site), public/favicon.png. Run: python3 scripts/brand-assets.py"""
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
src = Image.open("brand/logo-original.png").convert("RGBA"); src = src.crop(src.getchannel("A").getbbox()); W, H = src.size
os.makedirs("public/brand", exist_ok=True); os.makedirs("public/icons", exist_ok=True); os.makedirs("resources", exist_ok=True)
src.save("public/brand/logo.png")
wh = src.copy(); px = src.load(); pw = wh.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a: pw[x, y] = (10, 10, 11, a) if (r, g, b) == (255, 255, 255) else (244, 241, 234, a)
wh.save("public/brand/logo-white.png")
alpha = src.getchannel("A"); rows = [any(alpha.getpixel((x, y)) for x in range(0, W, 2)) for y in range(H)]
cut = next(y for y in range(1, H) if rows[y - 1] and not rows[y])
mb = src.crop((0, 0, W, cut)).getchannel("A").getbbox(); mark = src.crop((0, 0, W, cut)).crop(mb); mark.save("public/brand/mark.png"); wh.crop((0, 0, W, cut)).crop(mb).save("public/brand/mark-white.png")
def icon(size, pad=0.16):
    im = Image.new("RGBA", (size, size), (255, 255, 255, 255)); m = mark.copy(); s = int(size * (1 - 2 * pad)); m.thumbnail((s, s), Image.LANCZOS)
    im.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2)); return im
icon(1024).convert("RGB").save("resources/icon.png"); icon(1024, 0.22).save("resources/icon-foreground.png"); Image.new("RGBA", (1024, 1024), (255, 255, 255, 255)).save("resources/icon-background.png")
for n, s in [("icon-192", 192), ("icon-512", 512), ("apple-touch-icon", 180)]: icon(s).convert("RGB").save(f"public/icons/{n}.png")
sp = Image.new("RGBA", (2732, 2732), (255, 255, 255, 255)); l = src.copy(); l.thumbnail((1100, 1100), Image.LANCZOS); sp.alpha_composite(l, ((2732 - l.width) // 2, (2732 - l.height) // 2)); sp.convert("RGB").save("resources/splash.png")
fv = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); m = mark.copy(); m.thumbnail((64, 64), Image.LANCZOS); fv.alpha_composite(m, ((64 - m.width) // 2, (64 - m.height) // 2)); fv.save("public/favicon.png")
print("brand assets written")
