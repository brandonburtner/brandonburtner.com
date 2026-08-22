"""Generate app icons: a teal rounded square with a crescent moon (sleep) and
airflow waves (breathing). Writes icon-192.png, icon-512.png, apple-touch-icon.png."""
from PIL import Image, ImageDraw


def make(size):
    scale = 4
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # rounded-square background with a vertical teal->blue gradient
    radius = int(S * 0.22)
    grad = Image.new("RGB", (1, S))
    top, bot = (13, 148, 136), (15, 118, 178)  # teal -> blue
    for y in range(S):
        t = y / S
        grad.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    grad = grad.resize((S, S))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)

    # crescent moon (upper-left): white disc minus an offset disc
    moon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    md = ImageDraw.Draw(moon)
    cx, cy, r = int(S * 0.40), int(S * 0.40), int(S * 0.20)
    md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255))
    off = int(r * 0.55)
    md.ellipse([cx - r + off, cy - r - off, cx + r + off, cy + r - off],
               fill=(0, 0, 0, 0))
    img.alpha_composite(moon)

    # airflow waves (lower area): three rounded horizontal strokes
    d = ImageDraw.Draw(img)
    lw = int(S * 0.045)
    for i, (y, x0, x1) in enumerate([
        (0.66, 0.24, 0.74),
        (0.76, 0.30, 0.82),
        (0.86, 0.24, 0.66),
    ]):
        yy = int(S * y)
        d.rounded_rectangle([int(S * x0), yy - lw // 2, int(S * x1), yy + lw // 2],
                            radius=lw // 2, fill=(255, 255, 255, 235))

    return img.resize((size, size), Image.LANCZOS)


for sz, name in [(192, "public/icon-192.png"),
                 (512, "public/icon-512.png"),
                 (180, "public/apple-touch-icon.png")]:
    make(sz).save(name)
    print("wrote", name)
