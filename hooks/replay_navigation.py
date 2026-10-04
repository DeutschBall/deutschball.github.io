"""整理网站导航，并为目录首页自动生成下级内容索引。"""

from datetime import date
from pathlib import PurePosixPath
import posixpath
import re

from mkdocs.plugins import event_priority
from mkdocs.structure.pages import Page


REPLAY_PREFIX = "复盘/"
LEVEL_ORDER = {"业8": 0, "业7+": 1, "业3～业7": 2}
FULL_DATE_PATTERN = re.compile(r"@(\d{4})\.(\d{1,2})\.(\d{1,2})")
MONTH_PATTERN = re.compile(r"(\d{4})\.(\d{1,2})")
META_DATE_PATTERN = re.compile(r"^date:\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$", re.MULTILINE)


def _source_uri(page):
    return str(page.file.src_uri)


def _is_replay_article(page):
    uri = _source_uri(page)
    return uri.startswith(REPLAY_PREFIX) and PurePosixPath(uri).name != "index.md"


def _date_from_page(page):
    stem = PurePosixPath(_source_uri(page)).stem

    match = FULL_DATE_PATTERN.search(stem)
    if match:
        return date(*(int(part) for part in match.groups()))

    matches = list(MONTH_PATTERN.finditer(stem))
    if matches:
        year, month = (int(part) for part in matches[-1].groups())
        return date(year, month, 1)

    try:
        source = page.file.content_string
    except (OSError, ValueError):
        return date.min

    match = META_DATE_PATTERN.search(source)
    if match:
        return date(*(int(part) for part in match.groups()))
    return date.min


def _latest_replay_date(item):
    dates = []
    if isinstance(item, Page) and _is_replay_article(item):
        dates.append(_date_from_page(item))

    for child in getattr(item, "children", None) or []:
        dates.append(_latest_replay_date(child))

    return max(dates, default=date.min)


def _replay_level_name(item):
    if not isinstance(item, Page):
        return None
    parts = PurePosixPath(_source_uri(item)).parts
    if len(parts) >= 2 and parts[0] == "复盘":
        return parts[1]
    return None


def _prepare_replay_tree(item, inside_replay=False):
    uri = ""
    if isinstance(item, Page):
        uri = _source_uri(item)
        inside_replay = inside_replay or uri == "复盘/index.md" or uri.startswith(REPLAY_PREFIX)
        if _is_replay_article(item):
            # 导航标题以文件名为准，保留“@日期”。
            item.title = PurePosixPath(uri).stem

    children = getattr(item, "children", None) or []
    for child in children:
        _prepare_replay_tree(child, inside_replay)

    if uri == "复盘/index.md" and children:
        children.sort(key=lambda child: LEVEL_ORDER.get(_replay_level_name(child), len(LEVEL_ORDER)))
    elif inside_replay and children:
        # Python 的稳定排序会保留同一天文章的原有顺序。
        children.sort(key=_latest_replay_date, reverse=True)


def _flatten_pages(items):
    pages = []
    for item in items:
        if isinstance(item, Page):
            pages.append(item)
        children = getattr(item, "children", None) or []
        pages.extend(_flatten_pages(children))
    return pages


def _markdown_label(title):
    """避免页面标题中的 Markdown 符号破坏自动生成的链接。"""
    return str(title).replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")


def _item_title(item):
    title = getattr(item, "title", None)
    if title:
        return _markdown_label(title)

    if isinstance(item, Page):
        return _markdown_label(PurePosixPath(_source_uri(item)).stem)
    return "未命名"


def _index_lines(items, current_page, depth=0):
    """按导航顺序生成索引；无首页的目录继续展开到可点击页面。"""
    lines = []
    indent = "    " * depth
    current_dir = str(PurePosixPath(_source_uri(current_page)).parent)

    for item in items:
        if isinstance(item, Page):
            source_link = posixpath.relpath(_source_uri(item), current_dir)
            lines.append(f"{indent}- [{_item_title(item)}]({source_link})")
            continue

        children = getattr(item, "children", None) or []
        lines.append(f"{indent}- **{_item_title(item)}**")
        lines.extend(_index_lines(children, current_page, depth + 1))

    return lines


def _article_count(items):
    """递归统计目录下的文章，不把各级 index.md 计入篇数。"""
    count = 0
    for item in items:
        if isinstance(item, Page) and PurePosixPath(_source_uri(item)).name != "index.md":
            count += 1
        count += _article_count(getattr(item, "children", None) or [])
    return count


@event_priority(-50)
def on_nav(nav, **kwargs):
    for item in nav.items:
        _prepare_replay_tree(item)

    # 保持页面上一篇/下一篇链接与新导航顺序一致。
    nav.pages = _flatten_pages(nav.items)
    for index, page in enumerate(nav.pages):
        page.previous_page = nav.pages[index - 1] if index else None
        page.next_page = nav.pages[index + 1] if index + 1 < len(nav.pages) else None
    return nav


def on_page_markdown(markdown, page, **kwargs):
    """在每个 index.md 末尾追加所在目录的自动索引。"""
    source_uri = PurePosixPath(_source_uri(page))
    if source_uri.name != "index.md" or source_uri == PurePosixPath("index.md"):
        return markdown

    children = getattr(page, "children", None) or []
    article_count = _article_count(children)
    if article_count == 0:
        return f"{markdown.rstrip()}\n\n## 目录\n\n暂无内容。\n"

    lines = _index_lines(children, page)
    content = "\n".join(lines)
    return f"{markdown.rstrip()}\n\n## 目录\n\n共 {article_count} 篇\n\n{content}\n"
