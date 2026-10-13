"""Sugeneruoja PNG/ICO logotipus iš saskaitos/assets/nissan_logo.svg.

Paleisti tik pakeitus logotipą:  pip install cairosvg pillow
                                 python tools/generate_assets.py
"""

from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "saskaitos" / "assets"
SVG = (ASSETS / "nissan_logo.svg").read_text(encoding="utf-8")


def render(color: str, height: int) -> Image.Image:
    svg = SVG.replace('class="st0"', f'fill="{color}"')
    png = cairosvg.svg2png(bytestring=svg.encode(), output_height=height)
    return Image.open(BytesIO(png)).convert("RGBA")


render("#FFFFFF", 240).save(ASSETS / "nissan_logo_white.png", optimize=True)
render("#000000", 240).save(ASSETS / "nissan_logo_black.png", optimize=True)

# Programos ikona: juodas logotipas baltame fone.
icon = Image.new("RGBA", (256, 256), (255, 255, 255, 255))
logo = render("#000000", 186)
icon.alpha_composite(logo, ((256 - logo.width) // 2, (256 - logo.height) // 2))
icon.save(ASSETS / "app.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
icon.save(ASSETS / "app_icon.png", optimize=True)
print("OK:", ", ".join(p.name for p in sorted(ASSETS.iterdir())))
