"""Text rendered into the static board and its heading."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PositionLocale:
    title: str
    xiang_label: str
    chess_label: str
    red: tuple[str, str]
    white: tuple[str, str]
    black: tuple[str, str]


POSITION_LOCALES = {
    "en": PositionLocale(
        "Position", "Xiangqi position", "Chess position",
        ("Red", "Red to move"), ("White", "White to move"), ("Black", "Black to move"),
    ),
    "ru": PositionLocale(
        "Позиция", "Позиция в сянци", "Шахматная позиция",
        ("красные", "Ход красных"), ("белые", "Ход белых"), ("чёрные", "Ход чёрных"),
    ),
    "vi": PositionLocale(
        "Thế cờ", "Thế cờ tướng", "Thế cờ vua",
        ("Đỏ", "Lượt Đỏ"), ("Trắng", "Lượt Trắng"), ("Đen", "Lượt Đen"),
    ),
    "ko": PositionLocale(
        "국면", "샹치 국면", "체스 국면",
        ("홍", "홍의 차례"), ("백", "백의 차례"), ("흑", "흑의 차례"),
    ),
    "ja": PositionLocale(
        "局面", "シャンチーの局面", "チェスの局面",
        ("紅", "紅の手番"), ("白", "白の手番"), ("黒", "黒の手番"),
    ),
    "de": PositionLocale(
        "Stellung", "Xiangqi-Stellung", "Schachstellung",
        ("Rot", "Rot am Zug"), ("Weiß", "Weiß am Zug"), ("Schwarz", "Schwarz am Zug"),
    ),
    "fr": PositionLocale(
        "Position", "Position de xiangqi", "Position d’échecs",
        ("rouges", "Trait aux rouges"), ("blancs", "Trait aux blancs"), ("noirs", "Trait aux noirs"),
    ),
}

LANGUAGES = ("zh", *POSITION_LOCALES)
