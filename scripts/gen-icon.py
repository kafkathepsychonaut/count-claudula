# -*- coding: utf-8 -*-
# Generates the two Count Claudula icons from the pixel-art source:
#   build/icon.png                   -> teal-background icon, 1024px (Windows/macOS/Linux)
#   src/renderer/assets/claudula.png -> transparent, 256px (used inside the app)
# The teal background is removed by color distance, then cropped with a soft edge.
import os, math
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art", "claudula-source.png")
ASSETS = os.path.join(ROOT, "src", "renderer", "assets")
BUILD = os.path.join(ROOT, "build")
os.makedirs(ASSETS, exist_ok=True)
os.makedirs(BUILD, exist_ok=True)

img = Image.open(SRC).convert("RGB")
w, h = img.size
px = img.load()

# background color = average of a corner
br = bg = bb = n = 0
for yy in range(0, 20):
    for xx in range(0, 20):
        r, g, b = px[xx, yy]
        br += r; bg += g; bb += b; n += 1
br //= n; bg //= n; bb //= n

T_IN, T_OUT = 70.0, 125.0
out = Image.new("RGBA", (w, h))
op = out.load()
for yy in range(h):
    for xx in range(w):
        r, g, b = px[xx, yy]
        d = math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2)
        if d <= T_IN:
            a = 0
        elif d >= T_OUT:
            a = 255
        else:
            a = int((d - T_IN) / (T_OUT - T_IN) * 255)
        op[xx, yy] = (r, g, b, a)

# crop to the sprite + square canvas
bbox = out.getbbox()
cropped = out.crop(bbox)
cw, ch = cropped.size
side = max(cw, ch) + 24
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2))
canvas.resize((256, 256), Image.LANCZOS).save(os.path.join(ASSETS, "claudula.png"))
print("assets/claudula.png (transparent 256) ok")

# app icon (Windows/macOS/Linux): original art WITH teal background, 1024 (macOS wants >=512)
img.resize((1024, 1024), Image.LANCZOS).convert("RGBA").save(os.path.join(BUILD, "icon.png"))
print("build/icon.png (teal bg 1024) ok")
