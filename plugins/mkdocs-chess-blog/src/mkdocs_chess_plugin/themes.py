"""Resolve built-in styles and site-provided artwork."""

from dataclasses import dataclass
import json
import math
from pathlib import Path
import re
from typing import Optional

from mkdocs.exceptions import PluginError


THEME_NAME = re.compile(r"[a-z0-9][a-z0-9-]*")
IMAGE_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\.(?:svg|png|jpg|jpeg|gif|webp)", re.IGNORECASE)
DEFAULT = "default"
PRESET_ROOT = Path(__file__).with_name("assets") / "themes"
BUILTIN_STYLES = {
    "xiang": {"board": ("wood", "green"), "pieces": ("ivory", "ink", "wood")},
    "chess": {"board": ("wood", "green"), "pieces": ("ivory", "ink")},
}


@dataclass(frozen=True)
class Geometry:
    width: float
    height: float
    x: float
    y: float
    dx: float
    dy: float


@dataclass(frozen=True)
class BoardImage:
    uri: str
    geometry: Geometry


@dataclass(frozen=True)
class PieceImages:
    images: dict
    scale: float
    offset: tuple


@dataclass(frozen=True)
class Theme:
    game: str
    board: Optional[BoardImage]
    pieces: Optional[PieceImages]


def number(value, field):
    if type(value) not in (float, int) or not math.isfinite(value):
        raise ValueError(f"{field} must be a finite number")
    return value


def pair(value, field):
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{field} must have two numbers")
    return tuple(number(n, field) for n in value)


class ThemeCatalog:
    def __init__(self):
        self.themes = {}
        self.defaults = {}
        self.assets = {}
        self.preset_assets = {}

    def load(self, base, manifests, defaults, games):
        for manifest in sorted(PRESET_ROOT.glob("*/theme.json")):
            name = manifest.parent.name
            if name not in manifests:
                self.themes[name] = self.read_theme(name, manifest, games, self.preset_assets)

        for name, location in manifests.items():
            if not isinstance(name, str) or not THEME_NAME.fullmatch(name) or name == DEFAULT:
                raise PluginError(f"chess invalid theme name: {name!r}")
            try:
                if not isinstance(location, str):
                    raise ValueError("manifest path must be a string")
                manifest = (base / location).resolve(strict=True)
                self.themes[name] = self.read_theme(name, manifest, games, self.assets)
            except (OSError, ValueError, TypeError, KeyError, OverflowError) as error:
                raise PluginError(f"chess theme {name!r}: {error}") from error
        for game, options in defaults.items():
            if game not in games or not isinstance(options, dict) or options.keys() - {"board", "pieces"}:
                raise PluginError(f"chess invalid defaults for {game!r}")
            for kind, name in options.items():
                self.resolve(game, kind, name)
        self.defaults = defaults

    def read_theme(self, name, manifest, games, assets):
        data = json.loads(manifest.read_text(encoding="utf-8-sig"))
        if not isinstance(data, dict) or data.get("game") not in games:
            raise ValueError("game must be a registered chess or xiang board type")
        game = data["game"]
        variant = games[game]
        root = manifest.parent

        def image(filename):
            if not isinstance(filename, str) or not IMAGE_NAME.fullmatch(filename):
                raise ValueError(f"invalid artwork filename: {filename!r}")
            path = (root / filename).resolve(strict=True)
            if path.parent != root or not path.is_file():
                raise ValueError(f"artwork must be a file next to the manifest: {filename}")
            uri = f"themes/{name}/{filename}"
            assets[uri] = path
            return uri

        board = None
        if "board" in data:
            spec = data["board"]
            width, height = pair(spec["size"], "board.size")
            x, y = pair(spec["origin"], "board.origin")
            dx, dy = pair(spec["step"], "board.step")
            if not (dx > 0 and dy > 0 and
                    0 <= x < x + (variant.columns - 1) * dx < width and
                    0 <= y < y + (variant.rows - 1) * dy < height):
                raise ValueError("board grid must fit inside the image with positive steps")
            board = BoardImage(image(spec["image"]), Geometry(width, height, x, y, dx, dy))

        pieces = None
        if "pieces" in data:
            spec = data["pieces"]
            images = spec["images"]
            if not isinstance(images, dict) or images.keys() != set(variant.pieces):
                raise ValueError("pieces.images must map every piece letter in this game's FEN")
            scale = number(spec.get("scale", 1), "pieces.scale")
            if scale <= 0:
                raise ValueError("pieces.scale must be positive")
            offset = pair(spec.get("offset", [0, 0]), "pieces.offset")
            pieces = PieceImages({piece: image(file) for piece, file in images.items()}, scale, offset)
        if board is None and pieces is None:
            raise ValueError("expected a board or pieces entry")
        return Theme(game, board, pieces)

    def resolve(self, game, kind, name):
        if name == DEFAULT:
            return None
        theme = self.themes.get(name) if isinstance(name, str) else None
        value = getattr(theme, kind) if theme and theme.game == game else None
        if value is not None:
            return value
        if name in BUILTIN_STYLES.get(game, {}).get(kind, ()):
            return name
        raise PluginError(f"chess {game}: {name!r} has no compatible {kind} artwork")

    def select(self, game, classes):
        result = []
        for kind in ("board", "pieces"):
            prefix = kind + "-"
            overrides = [name[len(prefix):] for name in classes if name.startswith(prefix)]
            if len(overrides) > 1:
                raise PluginError(f"chess {game}: choose one {kind} theme per block")
            name = overrides[0] if overrides else self.defaults.get(game, {}).get(kind, DEFAULT)
            result.append(self.resolve(game, kind, name))
        return result
