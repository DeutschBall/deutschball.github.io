"""将 mkdocs.yml 中的功能开关应用到构建产物。"""
import re

from mkdocs.exceptions import ConfigurationError

DEFAULTS = {
    "xiangqi": True,
    "quotes": True,
    "cloud_analysis": True,
    "chess_library": True,
    "home_music": True,
    "floating_music": False,
}


def on_config(config):
    flags = {**DEFAULTS, **config.get("extra", {}).get("feature_flags", {})}
    for name, value in flags.items():
        if name not in DEFAULTS or type(value) is not bool:
            raise ConfigurationError(f"extra.feature_flags.{name}: 请使用已知开关和 true / false 布尔值")
    config["extra"]["feature_flags"] = flags
    for key, path, enabled in (
        ("extra_javascript", "javascripts/xiangqi-loader.js", flags["xiangqi"]),
        ("extra_css", "stylesheets/xiangqi.css", flags["xiangqi"]),
        ("extra_javascript", "javascripts/music.js", flags["floating_music"]),
        ("extra_css", "stylesheets/music.css", flags["floating_music"]),
    ):
        assets = config[key]
        assets[:] = [asset for asset in assets if str(asset) != path]
        if enabled:
            assets.append(path)
    return config


def on_page_markdown(markdown, page, config, **kwargs):
    flags = config["extra"]["feature_flags"]

    def render(match):
        return match.group(2) if flags[match.group(1)] else ""

    markdown = re.sub(
        r"<!-- feature:(\w+) -->(.*?)<!-- /feature -->",
        render, markdown, flags=re.DOTALL,
    )
    attrs = " ".join(
        f'data-{name.replace("_", "-")}="{str(flags[name]).lower()}"'
        for name in ("quotes", "cloud_analysis", "chess_library")
    )
    return markdown.replace('id="xiangqi-analysis"', f'id="xiangqi-analysis" {attrs}')
