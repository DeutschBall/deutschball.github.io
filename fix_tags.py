import re
import sys

def comment_non_chess_tags(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 检查是否包含中国象棋标签
    if '中国象棋' in content:
        print(f"保留: {filepath}")
        return

    # 注释掉 tags 部分（两行格式：tags: 和  - value）
    content = re.sub(r'^tags:\n  - (.+)$', r'# tags:\n#   - \1', content, flags=re.MULTILINE)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"已注释: {filepath}")

if __name__ == "__main__":
    for filepath in sys.argv[1:]:
        comment_non_chess_tags(filepath)
