"""Install and publish the Markdown extension and its self-contained assets."""

from importlib.resources import files
from html import escape
from pathlib import Path
import re

from mkdocs.config import config_options
from mkdocs.exceptions import PluginError
from mkdocs.plugins import BasePlugin, get_plugin_logger
from mkdocs.structure.files import File, InclusionLevel
from mkdocs.utils import get_relative_url

from .localization import LANGUAGES
from .markdown import BOARD_TYPES, BoardExtension
from .themes import ThemeCatalog


ASSET_PREFIX = "assets/mkdocs-chess-plugin/"
THEME_HREF = re.compile(r'href="fen-board-asset:(themes/[a-z0-9-]+/[A-Za-z0-9._-]+)"')
ASSETS = (
    "board.css", "loader.js", "board.mjs", "locales.mjs", "xiangqi-rules.mjs",
    "vendor/chess-1.4.0.mjs", "vendor/chess.js-LICENSE.txt",
)
SOUND_PRESETS = ("chesscom", "tiantian")
SOUND_EVENTS = ("move", "capture")
log = get_plugin_logger(__name__)


def load_sounds(root, option):
    prefix = ""
    if isinstance(option, str):
        if option not in SOUND_PRESETS:
            raise PluginError(f"Unknown chess sound preset {option!r}. Choose {', '.join(SOUND_PRESETS)}.")
        pack = root / "sound-packs" / option
        if not pack.exists():
            log.info("Sound pack '%s' is unavailable. Building without move sounds.", option)
            return {}
        prefix = f"{option}/"
        option = {event: str(pack / f"{event}.ogg") for event in SOUND_EVENTS}

    sounds = {}
    for event, source in option.items():
        if event not in SOUND_EVENTS or not isinstance(source, str):
            raise PluginError("chess sounds accepts move and capture file paths")
        path = root / source
        suffix = path.suffix.lower()
        if suffix not in (".mp3", ".ogg", ".wav") or not path.is_file():
            raise PluginError(f"chess sound {event!r} must be an existing MP3, Ogg or WAV file: {source}")
        sounds[event] = (prefix + event + suffix, path.resolve())
    return sounds


class ChessPlugin(BasePlugin):
    config_scheme = (
        ("language", config_options.Optional(config_options.Choice(LANGUAGES))),
        ("themes", config_options.Type(dict, default={})),
        ("defaults", config_options.Type(dict, default={})),
        ("sounds", config_options.Type((str, dict), default="chesscom")),
    )

    def on_config(self, config):
        self.catalog = ThemeCatalog()
        root = Path(config.config_file_path).parent if config.config_file_path else Path.cwd()
        self.catalog.load(root, self.config.get("themes", {}), self.config.get("defaults", {}), BOARD_TYPES)
        self.sounds = load_sounds(root, self.config.get("sounds", "chesscom"))
        extensions = config.markdown_extensions
        for extension in ("admonition", "pymdownx.details"):
            if extension not in extensions:
                extensions.append(extension)
        extensions[:] = [extension for extension in extensions if not isinstance(extension, BoardExtension)]
        extensions.append(BoardExtension(
            self.catalog, {event: name for event, (name, _) in self.sounds.items()},
            language=self.config.get("language"),
        ))

        for assets, name in ((config.extra_css, "board.css"), (config.extra_javascript, "loader.js")):
            uri = ASSET_PREFIX + name
            if not any(str(asset) == uri for asset in assets):
                assets.append(uri)
        return config

    def on_files(self, site_files, config):
        assets = files(__package__).joinpath("assets")
        for name in ASSETS:
            uri = ASSET_PREFIX + name
            if uri in site_files.src_uris:
                raise PluginError(f"chess asset conflicts with an existing file: {uri}")
            content = assets.joinpath(*name.split("/")).read_bytes()
            site_files.append(File.generated(config, uri, content=content))
        sound_assets = {"sounds/" + name: path for name, path in self.sounds.values()}
        self.preset_files = {}
        for name, path in {**self.catalog.preset_assets, **self.catalog.assets, **sound_assets}.items():
            uri = ASSET_PREFIX + name
            if uri in site_files.src_uris:
                raise PluginError(f"chess asset conflicts with an existing file: {uri}")
            file = File.generated(config, uri, abs_src_path=str(path))
            if name in self.catalog.preset_assets:
                # Copy bundled artwork only when a rendered page references it.
                file.inclusion = InclusionLevel.EXCLUDED
                self.preset_files[name] = file
            site_files.append(file)
        return site_files

    def on_page_content(self, html, page, **kwargs):
        def resolve(match):
            name = match.group(1)
            preset = self.preset_files.get(name)
            if preset is not None:
                preset.inclusion = InclusionLevel.INCLUDED
            elif name not in self.catalog.assets:
                return match.group()
            uri = get_relative_url(ASSET_PREFIX + name, page.url)
            return f'href="{escape(uri, quote=True)}"'

        return THEME_HREF.sub(resolve, html)
