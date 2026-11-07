import unittest
import xml.etree.ElementTree as ET

import markdown
from mkdocs.exceptions import PluginError

from mkdocs.config.defaults import MkDocsConfig
from mkdocs_chess_plugin import ChessPlugin
from mkdocs_chess_plugin.markdown import BoardExtension, parse_fen


START = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1"
CHESS = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def render(source):
    return markdown.markdown(source, extensions=[
        "admonition", "pymdownx.details", "pymdownx.superfences",
        "pymdownx.smartsymbols", "attr_list", BoardExtension(),
    ])


def tree(source):
    return ET.fromstring(f"<main>{render(source)}</main>")


class BoardTests(unittest.TestCase):
    def test_all_three_block_modes_work_without_a_body(self):
        for marker, tag, opened in (("???", "details", False), ("???+", "details", True), ("!!!", "div", False)):
            with self.subTest(marker=marker):
                block = tree(f'{marker} xiang "{START}"')[0]
                self.assertEqual(block.tag, tag)
                self.assertEqual("open" in block.attrib, opened)
                self.assertIn("fen-board", block.get("class"))
                expected_title = "局面" if tag == "details" else "局面图 · 红方走棋"
                self.assertEqual(block[0].find("span").text, expected_title)
                self.assertEqual(block.get("data-turn"), "w")
                self.assertEqual(block.find("figure").get("data-fen"), START)
                pieces = block.findall(".//{*}g[@data-piece]")
                self.assertEqual(len(pieces), 32)
                expected = {"a9": "r", "e9": "k", "h7": "c", "b2": "C", "e0": "K", "i0": "R"}
                actual = {p.get("data-square"): p.get("data-piece") for p in pieces}
                self.assertEqual({square: actual[square] for square in expected}, expected)
                cannon = next(p for p in pieces if p.get("data-square") == "h7")
                self.assertEqual(cannon.get("transform"), "translate(390 140)")

    def test_nested_blocks_keep_their_explanations_and_multiple_boards(self):
        source = f'''!!! note "分析"

    ??? board "{START}"

        先看**中炮**。

    !!! board "{START.replace(' w ', ' b ')}"

        黑方应对。

正文继续。
'''
        root = tree(source)
        self.assertEqual(len(root.findall(".//figure")), 2)
        self.assertEqual(root.find(".//strong").text, "中炮")
        self.assertIn("黑方应对。", "".join(root.itertext()))
        self.assertEqual(root[-1].text, "正文继续。")
        self.assertEqual(root.find(".//div[@class='admonition board fen-board']/p/span").text, "局面图 · 黑方走棋")

    def test_chess_tag_and_legacy_board_draw_the_eight_by_eight_position(self):
        for syntax in ("chess", "board"):
            with self.subTest(syntax=syntax):
                block = tree(f'??? {syntax} "{CHESS}"')[0]
                self.assertEqual(block.find("figure").get("data-game"), "chess")
                self.assertEqual(block[0].find("span").text, "Position")
                self.assertEqual(len(block.findall(".//{*}rect")), 64)
                self.assertEqual(block.find(".//{*}g[@data-square='e1']").get("data-piece"), "K")
                self.assertEqual(block.find(".//{*}g[@data-square='d8']").get("data-piece"), "q")

    def test_explicit_variants_reject_other_board_dimensions_and_bad_chess_fields(self):
        for syntax, value in (
            ("xiang", CHESS), ("chess", START),
            ("chess", CHESS.replace("KQkq", "KX")),
            ("chess", CHESS.replace("KQkq -", "KQkq a3")),
        ):
            with self.subTest(syntax=syntax, value=value):
                with self.assertRaisesRegex(PluginError, syntax + " 局面图 FEN 无效"):
                    render(f'??? {syntax} "{value}"')

    def test_fenced_and_inline_examples_and_other_admonitions_stay_literal(self):
        root = tree(f'''```markdown
??? board "{START}"
```

`!!! board "not a FEN"`

!!! note "board"

    原有提示块。
''')
        self.assertEqual(root.findall(".//figure"), [])
        self.assertIn('??? board "', "".join(root.itertext()))
        self.assertEqual(root.find(".//div/p").text, "board")

    def test_short_fen_aliases_and_whitespace(self):
        aliased = START.replace("n", "h").replace("N", "H").replace("b", "e").replace("B", "E")
        for value in (aliased, "\t" + aliased.replace(" ", "  ") + "\n", " ".join(START.split()[:2])):
            with self.subTest(value=value):
                board, turn, normalized = parse_fen(value)
                self.assertEqual(turn, "w")
                self.assertEqual(normalized, START)
                self.assertEqual(board[1], "n")
                self.assertEqual(board[83], "B")

    def test_invalid_fens_fail_the_build_instead_of_drawing_a_wrong_board(self):
        invalid = [
            "", "Board", START.split()[0], START.replace(" w ", " x "),
            START + " extra", START.replace("/9/", "/8/", 1),
            START.replace("/9/", "/99/", 1), START.replace("rnb", "rxb", 1),
            START.replace("/9/", "/0/", 1), START.replace("/9/", "/９/", 1),
            START.replace("/9", "", 1), START.replace("- - 0 1", "K - 0 1"),
            START.replace("- - 0 1", "- e3 0 1"), START.replace("0 1", "-1 1"),
            START.replace("0 1", "0 0"), START.replace("0 1", "0 1.5"),
            START.replace("0 1", "0 9007199254740992"),
            START.replace("0 1", "0 1e9"), START.replace("0 1", "０ 1"),
            '<img src=x onerror=alert(1)> w',
        ]
        for value in invalid:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    parse_fen(value)
                with self.assertRaisesRegex(PluginError, "board 局面图 FEN 无效"):
                    render(f'!!! board "{value}"')

    def test_studies_only_require_a_well_formed_diagram(self):
        board, turn, position = parse_fen("9/9/9/9/9/9/9/9/9/9 b")
        self.assertEqual(board, [None] * 90)
        self.assertEqual(turn, "b")
        self.assertTrue(position.endswith("b - - 0 1"))

    def test_plugin_registration_is_idempotent(self):
        config = MkDocsConfig()
        plugin = ChessPlugin()
        self.assertIs(plugin.on_config(config), config)
        plugin.on_config(config)
        self.assertEqual(sum(isinstance(ext, BoardExtension) for ext in config.markdown_extensions), 1)
        self.assertEqual(config.markdown_extensions.count("admonition"), 1)
        self.assertEqual(config.extra_css.count("assets/mkdocs-chess-plugin/board.css"), 1)


if __name__ == "__main__":
    unittest.main()
