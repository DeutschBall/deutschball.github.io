# 我的博客

使用 MkDocs Material 搭建的个人博客。

## 本地预览

```bash
# 安装依赖
pip install -r requirements.txt

# 启动本地服务器
mkdocs serve
```

访问 http://127.0.0.1:8000 预览博客。

## 部署

推送到 GitHub 的 main 分支后，GitHub Actions 会自动部署到 GitHub Pages。

## 添加文章

在 `docs/` 目录下创建 Markdown 文件，然后在 `mkdocs.yml` 的 `nav` 部分添加导航链接。

### 文章图片上传

文章写完后，由作者指定需要处理的文章，再让 AI 手动调用 PicGo 上传本地图片到 GitHub 图床并替换链接。
替换前验证外链确实返回图片，并核对本地文件与外链内容的哈希；正常可用的外链不重复上传。

## 象棋研究室开发与验证

网站运行无需 npm 包或 Node.js 服务，GitHub Pages 直接托管静态文件。
建站使用 Python 3.12 和 `requirements.txt` 中的依赖；棋谱生成与检查使用 Node.js 22 或更高版本。

```bash
# 安装开发测试依赖（Playwright 仅用于浏览器测试）
npm ci
npm run chess:check
npm test

# 更新文章后重新生成棋谱与索引
npm run chess:import

# 构建静态网站
python -m mkdocs build
```

浏览器测试使用本机 Google Chrome；未安装时可运行 `npx playwright install chrome`。
先在另一个终端运行 `python -m mkdocs serve -a 127.0.0.1:8001`，然后运行 `npm run test:browser`。
可通过 `BLOG_URL` 指定其他预览地址。云库集成测试需要联网。

推送 `main` 后，Actions 从同一份 `requirements.txt` 安装依赖，检查棋谱并运行单元测试，
再通过 `mkdocs gh-deploy` 发布到 `gh-pages`。GitHub Pages 应配置为从 `gh-pages` 分支根目录发布。

## 协作者

- **信球（DeutschBall）**：博客作者与维护者。
- **Codex（OpenAI）**：AI 编程协作者，协助开发象棋研究室、棋谱检索、随机名言及相关测试与文档；内容与发布由信球审定。

## 功能开关

在 `mkdocs.yml` 的 `extra.feature_flags` 中设置 `true` / `false`：

| 开关 | 功能 | 默认 |
| --- | --- | --- |
| `xiangqi` | 首页象棋研究室总开关 | `true` |
| `chess_laboratory` | Chess Laboratory 的国际象棋研究室 | `true` |
| `quotes` | 研究室随机名言 | `true` |
| `cloud_analysis` | 云库分析面板及查询 | `true` |
| `chess_library` | 博客棋谱检索面板及数据加载 | `true` |
| `home_music` | 首页网易云播放器 | `true` |
| `floating_music` | 全站悬浮音乐播放器 | `false` |

关闭 `xiangqi` 会移除整个研究室，名言、云库和棋谱功能随之停用；两种音乐开关独立生效。
关闭子功能会移除对应界面并停止其数据请求，基本走棋、悔棋、历史记录及 FEN 功能仍可用。
缺省开关沿用表中默认值。请使用布尔值，不要写成字符串 `"false"`。
修改后重新运行 `python -m mkdocs build`，部署生成的站点后线上生效；本地 `mkdocs serve` 会自动重建。
运行 `npm run test:features` 可自动构建并验证各开关组合（需要 Python 构建依赖和 Chrome，无需先启动预览服务）。
首页歌曲在 `docs/index.md` 修改；悬浮播放器曲目列表在 `docs/javascripts/music.js` 修改。

## 棋谱文字格式

### 在文章中插入可推演的 FEN 棋盘

```markdown
??? xiang "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1"

??? chess "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
```

`???` 默认折叠，`???+` 默认展开并可收起，`!!!` 始终显示。旧的 `board` 写法按 FEN 行数识别棋种。
可以点选棋子再点合法落点，也可以拖到落点。棋盘下方可以回到上一步或前进到下一步，标题图标随行棋方切换。
按住鼠标右键拖动可画推演箭头。右键点击箭头尖端或编号可删除单条，走棋后自动清空。

博客通过 `requirements.txt` 安装仓库内 `plugins/mkdocs-chess-blog/` 的插件，在 `mkdocs.yml` 的 `chess.defaults` 中设置棋盘和棋子。配置和用法见 [插件仓库](https://github.com/DeutschBall/mkdocs-chess-plugin)。
`npm run test:boards` 会在 Chrome 检查棋盘和推演。收录研究室棋谱仍按来源审计流程执行。

### 国际象棋研究室

「棋局研究室」侧栏里的 Chess Laboratory 支持国际象棋推演、FEN、着法回放及 Lichess 云端缓存评估。访客可以在「我的博客棋谱」导入一盘带分支的 PGN，棋谱保存在当前浏览器。
站点作者可以在 `docs/assets/chess/laboratory-games.json` 登记棋谱。每条包含 `title`、指向本站文章的 `url` 和一盘 `pgn`，支持带 `FEN` 标签的非标准起始局面。登记前核对正文来源和棋谱，构建后用研究室的局面检索检查匹配及回放。

### 编号着法与来源审计

`布局棋理/疑形/` 按具体疑形分篇，每篇使用「典型局面」「局例」两个二级标题。
《疑形与攻击》保留为两个布局合集，正文直接放在子目录首页。
各级 `index.md` 的下级链接与递归文章数由 `hooks/replay_navigation.py` 在构建时生成；普通索引页和旧链接兼容页不计数，标记 `directory_article: true` 的正文首页计一篇并直接显示内容。
本次合集拆分的内容、配图与原棋谱校验依据保存在 `data/chess/doubt-split.json`；图片或讲解不足以还原的条目仍需补充棋谱来源。
布局棋理的图片使用「局面图」折叠框，推演和分析使用嵌套提示框；格式改造前的内容与回放校验依据保存在 `data/chess/layout-format.json`。运行 `node tests/layout-format.browser.mjs` 可检查全部正文、目录计数和研究室回放。
后续新增文章的审定元数据、配图和回放预期登记在 `data/chess/additional-articles.json`，用于验证增量并保留历史校验基线；可运行 `node tests/additional-articles.browser.mjs` 验收新增文章。

编号支持 `1、着法`、`1、 着法`、`1.着法`、`1. 着法`。
两着之间可使用空白或 Unicode 标点、符号，例如 `1. 炮二平五；马８进７`，也可用逗号、斜杠或箭头。
分隔处的中文说明、字母和额外数字不会被忽略，请把讲解另起一行。
`1. 炮二平五 …` 只记录红方这一着；`1. … 马８进７` 表示仅记录黑方这一着，须有该回合红方的连续来源。
支持 `…`、`……` 和 `...` 等省略号形式。省略的着法不会自动补全，缺少连续来源时后续内容会列入导入报告待核对。
