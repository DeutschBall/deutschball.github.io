"""Turn FEN-titled admonitions into SVG boards with a no-script fallback."""

from dataclasses import dataclass
import re
from typing import Callable
import xml.etree.ElementTree as ET

from markdown.extensions import Extension
from markdown.treeprocessors import Treeprocessor
from mkdocs.exceptions import PluginError

from .localization import POSITION_LOCALES
from .themes import BoardImage, Geometry, PieceImages, ThemeCatalog


XIANG_NAMES = dict(zip("KABNRCPkabnrcp", "帅仕相马车炮兵将士象马车炮卒"))
XIANG_ALIASES = str.maketrans("HhEe", "NnBb")
MAX_COUNTER = str(2**53 - 1)

# Original flat silhouettes on a 48 × 48 canvas, shared by both colors.
CHESS_SHAPES = {
    "k": ("M22 4H26V10H32V14H26V20H22V14H16V10H22Z",
          "M14 33C13 27 10 23 10 20C10 15 18 14 24 22C30 14 38 15 38 20C38 23 35 27 34 33L36 41H12Z"),
    "q": ("M8 16L17 24L24 13L31 24L40 16L34 34L36 41H12L14 34Z",
          "M14 34H34"),
    "r": ("M9 8H16V14H20V8H28V14H32V8H39V20L33 25V34L37 40H11L15 34V25L9 20Z",
          "M15 25H33M15 34H33"),
    "b": ("M24 8C27 12 35 18 35 24C35 29 31 32 27 34H34L37 41H11L14 34H21C17 32 13 29 13 24C13 18 21 12 24 8Z",
          "M26 17L21 24M21 34H27"),
    "n": ("M12 41H36C37 28 34 16 27 10L19 6L18 14L9 25L12 30L22 25C21 29 15 32 12 35Z",
          "M21 17H22"),
    "p": ("M24 8A8 8 0 0 1 28 23C29 28 31 33 36 37V41H12V37C17 33 19 28 20 23A8 8 0 0 1 24 8Z",),
}


def xiang_piece(node, piece):
    node.set("class", "fen-board-xiang-light" if piece.isupper() else "fen-board-xiang-dark")
    ET.SubElement(node, "circle", {"r": "22", "class": "fen-board-disc"})
    ET.SubElement(node, "circle", {"r": "18.5", "class": "fen-board-ring"})
    ET.SubElement(node, "text", {"y": "1", "class": "fen-board-character"}).text = XIANG_NAMES[piece]


def chess_piece(node, piece):
    color = "light" if piece.isupper() else "dark"
    drawing = ET.SubElement(node, "g", {"class": f"fen-board-chess-{color}", "transform": "translate(-24 -24)"})
    for path in CHESS_SHAPES[piece.lower()]:
        ET.SubElement(drawing, "path", {"d": path})
    if piece.lower() == "q":
        for x, y in ((8, 13), (24, 10), (40, 13)):
            ET.SubElement(drawing, "circle", {"cx": str(x), "cy": str(y), "r": "2.6"})
    if piece.lower() == "b":
        ET.SubElement(drawing, "circle", {"cx": "24", "cy": "6", "r": "2.5"})


def xiang_grid(svg):
    grid = ET.SubElement(svg, "g", {"class": "fen-board-xiang-grid"})
    for y in range(10):
        ET.SubElement(grid, "path", {"d": f"M40 {40 + y * 50} H440"})
    for x in range(9):
        file = 40 + x * 50
        path = f"M{file} 40 V490" if x in (0, 8) else f"M{file} 40 V240 M{file} 290 V490"
        ET.SubElement(grid, "path", {"d": path})
    ET.SubElement(grid, "path", {"d": "M190 40 L290 140 M290 40 L190 140 M190 390 L290 490 M290 390 L190 490"})
    ET.SubElement(grid, "rect", {"x": "34", "y": "34", "width": "412", "height": "462"})
    river = ET.SubElement(svg, "g", {"class": "fen-board-river"})
    for x, label in ((140, "楚 河"), (340, "汉 界")):
        ET.SubElement(river, "text", {"x": str(x), "y": "273"}).text = label
    files = ET.SubElement(svg, "g", {"class": "fen-board-coords"})
    for x, label in enumerate("九八七六五四三二一"):
        file = str(40 + x * 50)
        ET.SubElement(files, "text", {"x": file, "y": "526", "class": "fen-board-xiang-light"}).text = label
        ET.SubElement(files, "text", {"x": file, "y": "15"}).text = str(x + 1)


def chess_grid(svg):
    grid = ET.SubElement(svg, "g")
    for row in range(8):
        for col in range(8):
            color = "dark" if (row + col) % 2 else "light"
            ET.SubElement(grid, "rect", {
                "x": str(24 + col * 54), "y": str(24 + row * 54),
                "width": "54", "height": "54", "class": f"fen-board-tile-{color}",
            })
    labels = ET.SubElement(svg, "g", {"class": "fen-board-coords"})
    for index in range(8):
        center = 51 + index * 54
        ET.SubElement(labels, "text", {"x": str(center), "y": "473"}).text = chr(97 + index)
        ET.SubElement(labels, "text", {"x": "12", "y": str(center + 5)}).text = str(8 - index)


def xiang_fields(castling, en_passant, _turn):
    if (castling, en_passant) != ("-", "-"):
        raise ValueError("中国象棋的两个占位字段应为 - -")


def chess_fields(castling, en_passant, turn):
    if castling != "-" and not re.fullmatch(r"K?Q?k?q?", castling):
        raise ValueError("国际象棋的易位权应为 KQkq 的子集或 -")
    rank = "6" if turn == "w" else "3"
    if en_passant != "-" and not re.fullmatch(f"[a-h]{rank}", en_passant):
        raise ValueError("国际象棋的过路兵目标格与行棋方不符")


@dataclass(frozen=True)
class BoardType:
    label: str
    light: str
    columns: int
    rows: int
    origin: int
    step: int
    height: int
    pieces: str
    aliases: dict
    validate_fields: Callable
    draw_grid: Callable
    draw_piece: Callable


BOARD_TYPES = {
    "xiang": BoardType("局面图", "红", 9, 10, 40, 50, 530, "".join(XIANG_NAMES),
                       XIANG_ALIASES, xiang_fields, xiang_grid, xiang_piece),
    "chess": BoardType("国际象棋局面", "白", 8, 8, 51, 54, 480, "KQRBNPkqrbnp",
                       {}, chess_fields, chess_grid, chess_piece),
}


def infer_game(value):
    fields = value.split()
    ranks = len(fields[0].split("/")) if fields else 0
    matches = [key for key, style in BOARD_TYPES.items() if style.rows == ranks]
    if len(matches) != 1:
        raise ValueError("无法识别棋盘行数，请使用 chess 或 xiang 指定棋种")
    return matches[0]


def parse_fen(value, game=None):
    """Validate FEN syntax while allowing illustrative, non-playable studies."""
    style = BOARD_TYPES[game or infer_game(value)]
    fields = value.split()
    if len(fields) not in (2, 6) or fields[1] not in ("w", "b"):
        raise ValueError(f"需包含棋盘和行棋方 w（{style.light}）或 b（黑）")
    if len(fields) == 2:
        fields.extend(["-", "-", "0", "1"])
    style.validate_fields(fields[2], fields[3], fields[1])
    if (
        not re.fullmatch(r"[0-9]+", fields[4])
        or not re.fullmatch(r"[1-9][0-9]*", fields[5])
        or any((len(n), n) > (len(MAX_COUNTER), MAX_COUNTER)
               for n in (value.lstrip("0") for value in fields[4:]))
    ):
        raise ValueError("FEN 计数字段无效")

    rows = fields[0].translate(style.aliases).split("/")
    if len(rows) != style.rows:
        raise ValueError(f"此棋种的棋盘必须有 {style.rows} 行")
    board = []
    for rank, row in enumerate(rows, 1):
        cells = []
        for char in row:
            if "1" <= char <= str(style.columns):
                cells.extend([None] * int(char))
            elif char in style.pieces:
                cells.append(char)
            else:
                raise ValueError(f"第 {rank} 行包含未知棋子或字符 {char!r}")
        if len(cells) != style.columns:
            raise ValueError(f"第 {rank} 行必须有 {style.columns} 个位置，实际为 {len(cells)} 个")
        board.extend(cells)
    fields[0] = "/".join(rows)
    return board, fields[1], " ".join(fields)


def artwork_image(parent, uri, x, y, width, height):
    return ET.SubElement(parent, "image", {
        "href": f"fen-board-asset:{uri}", "x": f"{x:g}", "y": f"{y:g}",
        "width": f"{width:g}", "height": f"{height:g}",
    })


def king_icons(title, style, piece_theme):
    for side, king in (("w", "K"), ("b", "k")):
        icon = ET.SubElement(title, "svg", {
            "class": "fen-board-icon", "data-color": side, "viewBox": "-24 -24 48 48",
            "aria-hidden": "true", "focusable": "false", "xmlns": "http://www.w3.org/2000/svg",
        })
        if isinstance(piece_theme, PieceImages):
            artwork_image(icon, piece_theme.images[king], -24, -24, 48, 48)
        else:
            if isinstance(piece_theme, str):
                icon.set("data-pieces-style", piece_theme)
            style.draw_piece(ET.SubElement(icon, "g"), king)


def position_text(game, language):
    style = BOARD_TYPES[game]
    locale = POSITION_LOCALES.get(language)
    if locale:
        label = {"xiang": locale.xiang_label, "chess": locale.chess_label}.get(game, locale.title)
        light, turn_w = locale.red if game == "xiang" else locale.white
        dark, turn_b = locale.black
        return {
            "lang": language, "data-label": label, "data-light": light, "data-dark": dark,
            "data-turn-w": turn_w, "data-turn-b": turn_b,
        }
    return {
        "lang": "zh", "data-label": style.label, "data-light": style.light, "data-dark": "黑",
        "data-turn-w": f"{style.light}方走棋", "data-turn-b": "黑方走棋",
    }


def diagram(board, position, game, prefix, label, board_theme, piece_theme, text):
    style = BOARD_TYPES[game]
    board_image = board_theme if isinstance(board_theme, BoardImage) else None
    piece_images = piece_theme if isinstance(piece_theme, PieceImages) else None
    geometry = board_image.geometry if board_image else Geometry(
        480, style.height, style.origin, style.origin, style.step, style.step,
    )
    width, height = geometry.width, geometry.height
    x, y, dx, dy = geometry.x, geometry.y, geometry.dx, geometry.dy
    grid = (style.columns, style.rows, x, y, dx, dy, width, height)
    figure = ET.Element("figure", {
        "class": "fen-board-figure", "data-fen": position, "data-game": game, "data-prefix": prefix,
        "data-grid": " ".join(f"{n:g}" for n in grid),
        **text,
    })
    if board_image:
        figure.set("data-board-art", "")
    if isinstance(board_theme, str):
        figure.set("data-board-style", board_theme)
    if isinstance(piece_theme, str):
        figure.set("data-pieces-style", piece_theme)
    surface = ET.SubElement(figure, "div", {"class": "fen-board-surface"})
    svg = ET.SubElement(surface, "svg", {
        "xmlns": "http://www.w3.org/2000/svg", "viewBox": f"0 0 {width:g} {height:g}",
        "role": "img", "aria-label": label, "focusable": "false",
    })
    ET.SubElement(svg, "desc").text = f"FEN: {position}"
    defs = ET.SubElement(svg, "defs")
    for piece in style.pieces:
        shape = ET.SubElement(defs, "g", {"id": f"{prefix}-{piece}"})
        if piece_images:
            w, h = dx * piece_images.scale, dy * piece_images.scale
            ox, oy = piece_images.offset
            artwork_image(shape, piece_images.images[piece], dx * ox - w / 2, dy * oy - h / 2, w, h)
        else:
            if board_image:
                ratio = min(dx, dy) / style.step
                shape.set("transform", f"scale({ratio:g})")
            style.draw_piece(shape, piece)
    if board_image:
        artwork_image(svg, board_image.uri, 0, 0, width, height)
    else:
        style.draw_grid(svg)
    layer = ET.SubElement(svg, "g", {"class": "fen-board-pieces"})
    for index, piece in enumerate(board):
        if piece is None:
            continue
        row, col = divmod(index, style.columns)
        rank = style.rows - row - (1 if game == "xiang" else 0)
        group = ET.SubElement(layer, "g", {
            "transform": f"translate({x + col * dx:g} {y + row * dy:g})",
            "data-square": f"{chr(97 + col)}{rank}", "data-piece": piece,
        })
        ET.SubElement(group, "use", {"href": f"#{prefix}-{piece}"})
    return figure


class BoardTreeprocessor(Treeprocessor):
    def __init__(self, md, catalog, sounds, language):
        super().__init__(md)
        self.catalog = catalog
        self.sounds = sounds
        self.language = language

    def run(self, root):
        count = 0
        for block in list(root.iter()):
            classes = block.get("class", "").split()
            if block.tag == "details":
                title_tag = "summary"
            elif block.tag == "div" and "admonition" in classes:
                title_tag = "p"
            else:
                continue
            choices = [name for name in classes if name in BOARD_TYPES or name == "board"]
            if not choices:
                continue
            if len(choices) != 1:
                raise PluginError("Each board block must specify exactly one board type")
            syntax = choices[0]
            title = block[0] if len(block) and block[0].tag == title_tag else None
            value = "" if title is None else "".join(title.itertext()).strip()
            try:
                game = infer_game(value) if syntax == "board" else syntax
                board, turn, position = parse_fen(value, game)
            except ValueError as error:
                raise PluginError(f'{syntax} 局面图 FEN 无效（{value}）：{error}') from error
            style = BOARD_TYPES[game]
            board_theme, piece_theme = self.catalog.select(game, classes)
            text = position_text(game, self.language)
            label = f"{text['data-label']} · {text[f'data-turn-{turn}']}"
            for child in list(title):
                title.remove(child)
            title.text = None
            king_icons(title, style, piece_theme)
            heading = ET.SubElement(title, "span", {"class": "fen-board-title", "lang": text["lang"]})
            if title_tag == "summary":
                heading_language = self.language or ("en" if game == "chess" else "zh")
                locale = POSITION_LOCALES.get(heading_language)
                heading.text = locale.title if locale else "局面"
                heading.set("lang", heading_language)
            else:
                heading.text = label
            block.set("class", " ".join([*classes, "fen-board"]))
            block.set("data-turn", turn)
            count += 1
            figure = diagram(board, position, game, f"fen-board-{count}", label, board_theme, piece_theme, text)
            for event, filename in self.sounds.items():
                figure.set(f"data-sound-{event}", filename)
            block.insert(1, figure)


class BoardExtension(Extension):
    def __init__(self, catalog=None, sounds=None, language=None):
        super().__init__()
        self.catalog = catalog if catalog is not None else ThemeCatalog()
        self.sounds = sounds or {}
        self.language = language

    def extendMarkdown(self, md):
        # Process parsed admonitions. Fenced and inline examples stay literal.
        md.treeprocessors.register(BoardTreeprocessor(md, self.catalog, self.sounds, self.language), "fen_board", 15)
