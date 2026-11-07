# FEN 局面图预览

## 中国象棋 · 默认折叠

??? xiang "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1"

    标准初始局面，红方先行。

## 国际象棋 · 默认展开

???+ chess "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

    点击 e2 的白兵，再点 e4。走棋后标题会切换到黑王图标。

## 中炮局面

!!! xiang "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1"

    红方已走**炮二平五**，轮到黑方。

## 嵌套提示块

!!! note "局面分析"

    ??? board "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b"

        棋盘可以放进其他提示块，**说明文字**也会保留。

## 国际象棋 · 特殊走法

??? chess "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"

    试试白王从 e1 到 g1，完成王翼易位。

??? chess "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2"

    白兵从 e5 到 d6，可以吃过路兵。

??? chess "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"

    白兵从 a7 到 a8，选择升变棋子。

## 代码示例

```markdown
??? xiang "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1"
??? chess "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
```
