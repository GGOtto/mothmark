#!/usr/bin/env python3
"""Build the approved raster-only Mothmark logo package from its mockup."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


INK = (5, 28, 44)
PARCHMENT = (250, 247, 240)
SIZES = (16, 32, 48, 180, 192, 512)
OPTICAL_FAVICON_OCCUPANCY = 0.94
OPTICAL_FAVICON_BOUNDS_ALPHA = 32


def smooth_alpha(values: np.ndarray) -> np.ndarray:
    values = np.clip((values - 0.055) / 0.88, 0.0, 1.0)
    values[values < 0.025] = 0.0
    return (values * 255.0 + 0.5).astype(np.uint8)


def dark_art_mask(source: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = np.asarray(source.crop(box).convert("RGB"), dtype=np.float32)
    luminance = crop.mean(axis=2)
    # The approved sheet uses a warm near-white field and deep navy artwork.
    alpha = smooth_alpha((246.0 - luminance) / 231.0)
    return Image.fromarray(alpha, "L")


def light_art_mask(source: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = np.asarray(source.crop(box).convert("RGB"), dtype=np.float32)
    luminance = crop.mean(axis=2)
    # The reversed lockup uses parchment artwork on the deep navy field.
    alpha = smooth_alpha((luminance - 16.0) / 226.0)
    return Image.fromarray(alpha, "L")


def trim(mask: Image.Image, padding: int = 0) -> Image.Image:
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError("Artwork crop produced an empty mask")
    left, top, right, bottom = bbox
    return mask.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(mask.width, right + padding),
            min(mask.height, bottom + padding),
        )
    )


def colorize(mask: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGBA", mask.size, (*color, 0))
    image.putalpha(mask)
    return image


def save_scaled(image: Image.Image, path: Path, scale: int = 1) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if scale != 1:
        image = image.resize(
            (image.width * scale, image.height * scale), Image.Resampling.LANCZOS
        )
    image.save(path, optimize=True)


def square_mark(
    mask: Image.Image,
    size: int,
    occupancy: float,
    bounds_alpha: int = 1,
) -> Image.Image:
    bounds_mask = mask.point(lambda value: 255 if value >= bounds_alpha else 0)
    bbox = bounds_mask.getbbox()
    if bbox is None:
        raise ValueError("Artwork crop produced an empty mask")
    mark = mask.crop(bbox)
    max_width = max(1, round(size * occupancy))
    max_height = max(1, round(size * occupancy))
    scale = min(max_width / mark.width, max_height / mark.height)
    resized = mark.resize(
        (max(1, round(mark.width * scale)), max(1, round(mark.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("L", (size, size), 0)
    canvas.paste(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


def rounded_crop(
    source: Image.Image,
    box: tuple[int, int, int, int],
    radius_ratio: float,
) -> Image.Image:
    crop = source.crop(box).convert("RGBA")
    mask = Image.new("L", crop.size, 0)
    draw = ImageDraw.Draw(mask)
    radius = round(min(crop.size) * radius_ratio)
    draw.rounded_rectangle((0, 0, crop.width - 1, crop.height - 1), radius=radius, fill=255)
    crop.putalpha(mask)
    return crop


def app_icon_from_mask(mask: Image.Image, dark: bool) -> Image.Image:
    size = 512
    radius = 94
    field = INK if dark else PARCHMENT
    artwork = PARCHMENT if dark else INK
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    field_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(field_mask).rounded_rectangle(
        (10, 10, size - 11, size - 11), radius=radius, fill=255
    )
    field_layer = Image.new("RGBA", (size, size), (*field, 0))
    field_layer.putalpha(field_mask)
    image.alpha_composite(field_layer)
    mark_mask = square_mark(mask, 512, 0.64)
    image.alpha_composite(colorize(mark_mask, artwork))
    return image


def profile_from_mask(mask: Image.Image, dark: bool) -> Image.Image:
    size = 512
    field = INK if dark else PARCHMENT
    artwork = PARCHMENT if dark else INK
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    circle = Image.new("L", (size, size), 0)
    ImageDraw.Draw(circle).ellipse((4, 4, size - 5, size - 5), fill=255)
    field_layer = Image.new("RGBA", (size, size), (*field, 0))
    field_layer.putalpha(circle)
    image.alpha_composite(field_layer)
    mark_mask = square_mark(mask, size, 0.66)
    image.alpha_composite(colorize(mark_mask, artwork))
    return image


def build(mockup: Path, output: Path) -> None:
    source = Image.open(mockup).convert("RGB")
    if source.size != (1536, 1024):
        raise ValueError(f"Expected the approved 1536x1024 mockup, got {source.size}")

    # Intact crops preserve the exact geometry, spacing, and wordmark placement shown.
    masks = {
        "header-primary": trim(dark_art_mask(source, (35, 95, 690, 285)), 4),
        "header-compact-light": trim(dark_art_mask(source, (440, 410, 905, 550)), 4),
        "header-compact-dark": trim(light_art_mask(source, (975, 410, 1470, 550)), 4),
        "vertical": trim(dark_art_mask(source, (740, 85, 1080, 330)), 4),
        "basic": trim(dark_art_mask(source, (1190, 85, 1435, 295)), 4),
        "favicon-full": trim(dark_art_mask(source, (535, 850, 635, 925)), 2),
        "favicon-optical-32": trim(dark_art_mask(source, (700, 860, 810, 925)), 2),
        "favicon-optical-16": trim(dark_art_mask(source, (875, 880, 940, 925)), 2),
        "app-mark": trim(dark_art_mask(source, (830, 675, 942, 772)), 2),
    }

    for theme, color in (("light", INK), ("dark", PARCHMENT)):
        folder = output / theme
        folder.mkdir(parents=True, exist_ok=True)

        primary = colorize(masks["header-primary"], color)
        save_scaled(primary, folder / "header-primary.png")
        save_scaled(primary, folder / "header-primary@2x.png", 2)

        compact_key = "header-compact-light" if theme == "light" else "header-compact-dark"
        compact = colorize(masks[compact_key], color)
        save_scaled(compact, folder / "header-compact.png")
        save_scaled(compact, folder / "header-compact@2x.png", 2)

        vertical = colorize(masks["vertical"], color)
        save_scaled(vertical, folder / "vertical.png")
        save_scaled(vertical, folder / "vertical@2x.png", 2)

        basic = colorize(masks["basic"], color)
        save_scaled(basic, folder / "basic.png")
        save_scaled(basic, folder / "basic@2x.png", 2)

        app = app_icon_from_mask(masks["app-mark"], dark=theme == "dark")
        save_scaled(app, folder / "app-icon-512.png")

    # Use the profile panel's own source pixels. Only the area outside each approved circle is removed.
    light_profile = rounded_crop(source, (40, 400, 200, 560), 0.5)
    dark_profile = rounded_crop(source, (212, 400, 372, 560), 0.5)
    save_scaled(
        light_profile.resize((512, 512), Image.Resampling.LANCZOS),
        output / "light" / "profile-512.png",
    )
    save_scaled(
        dark_profile.resize((512, 512), Image.Resampling.LANCZOS),
        output / "dark" / "profile-512.png",
    )

    for theme, color in (("light", INK), ("dark", PARCHMENT)):
        folder = output / theme
        for family, occupancy in (
            ("full", 0.88),
            ("optical", OPTICAL_FAVICON_OCCUPANCY),
        ):
            source_mask = masks[f"favicon-{family}"] if family == "full" else masks["favicon-optical-32"]
            for size in SIZES:
                bounds_alpha = (
                    OPTICAL_FAVICON_BOUNDS_ALPHA
                    if family == "optical" and size <= 48
                    else 1
                )
                if family == "optical" and size == 16:
                    favicon_mask = square_mark(
                        masks["favicon-optical-16"],
                        size,
                        OPTICAL_FAVICON_OCCUPANCY,
                        bounds_alpha,
                    )
                else:
                    favicon_mask = square_mark(
                        source_mask,
                        size,
                        occupancy,
                        bounds_alpha,
                    )
                colorize(favicon_mask, color).save(
                    folder / f"favicon-{family}-{size}.png", optimize=True
                )

            master_bounds_alpha = (
                OPTICAL_FAVICON_BOUNDS_ALPHA if family == "optical" else 1
            )
            master = colorize(
                square_mark(source_mask, 512, occupancy, master_bounds_alpha),
                color,
            )
            master.save(
                folder / f"favicon-{family}.ico",
                format="ICO",
                sizes=[(16, 16), (32, 32), (48, 48), (256, 256)],
            )

        # The full approved mark is the default; the optical mark remains an explicit alternative.
        (folder / "favicon.ico").write_bytes((folder / "favicon-full.ico").read_bytes())

    manifest = {
        "version": 4,
        "format": "raster-only",
        "source": mockup.name,
        "sourceSha256": hashlib.sha256(mockup.read_bytes()).hexdigest(),
        "transparentBackgrounds": True,
        "palette": {"lightArtwork": "#071C2C", "darkArtwork": "#FAF7F0"},
        "variants": {
            "header-primary": "Approved primary horizontal lockup, intact spacing",
            "header-compact": "Approved compact website-header lockup, intact spacing",
            "vertical": "Approved vertical lockup",
            "basic": "Approved standalone master symbol",
            "profile-512": "Approved light/dark circular profile treatments",
            "app-icon-512": "Approved rounded-square app treatment in light/dark",
            "favicon-full": "Complete moth/book master mark",
            "favicon-optical": "Antenna-free optical favicon simplification sized for browser tabs",
        },
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mockup", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.mockup, args.output)


if __name__ == "__main__":
    main()
