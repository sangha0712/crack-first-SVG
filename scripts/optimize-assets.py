"""Rebuild render assets with Pillow and fontTools; keep originals as fallbacks."""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HAN_RANGES = ((0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF),
              (0x20000, 0x323AF))


def is_han(codepoint):
    return any(start <= codepoint <= end for start, end in HAN_RANGES)


for weight in ("Regular", "Bold"):
    original = ROOT / f"NotoSansKR-{weight}.ttf"
    font = TTFont(original, recalcTimestamp=False)
    original_cmap = font.getBestCmap()
    wanted = {cp for cp in original_cmap if not is_han(cp)}
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=wanted)
    subsetter.subset(font)
    assert set(font.getBestCmap()) == wanted, "Unexpected character coverage change"
    output = ROOT / f"NotoSansKR-{weight}-ui.ttf"
    font.save(output)
    print(f"{output.name}: {original.stat().st_size:,} -> {output.stat().st_size:,} bytes; "
          f"{len(wanted):,} characters (full fonts retained for Han text)")

with Image.open(ROOT / "hr.png") as avatar:
    # The largest avatar is 37 CSS pixels, or 111 pixels at the retained 3x scale.
    avatar.convert("RGBA").resize((128, 128), Image.Resampling.LANCZOS).save(
        ROOT / "hr-render.png", optimize=True)
print(f"hr-render.png: {(ROOT / 'hr.png').stat().st_size:,} -> "
      f"{(ROOT / 'hr-render.png').stat().st_size:,} bytes")
