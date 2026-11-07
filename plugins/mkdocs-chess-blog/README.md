# MkDocs chess plugin for this blog

The blog installs this source snapshot through its root `requirements.txt`.
It includes Chess.com, Tiantian Xiangqi, and Lianzhong Classic board and piece themes.
Choose the default styles under `plugins.chess.defaults` in the blog's `mkdocs.yml`.

The Lianzhong theme uses the wood texture, river lettering, pieces, and sounds
from the [Lianzhong Classic Windows client](https://www.ourgame.com/download/)
(version 1.41.0.3). Select its board and pieces with `defaults.xiang` and its
move, capture, and check sounds with the separate site-wide `sounds` setting.

```yaml
plugins:
  - chess:
      defaults:
        xiang:
          board: lianzhong
          pieces: lianzhong
      sounds: lianzhong
```

Upstream source: https://github.com/DeutschBall/mkdocs-chess-plugin
