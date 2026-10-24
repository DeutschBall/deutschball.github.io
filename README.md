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

编号支持 `1、着法`、`1、 着法`、`1.着法`、`1. 着法`。
两着之间可使用空白或 Unicode 标点、符号，例如 `1. 炮二平五；马８进７`，也可用逗号、斜杠或箭头。
分隔处的中文说明、字母和额外数字不会被忽略，请把讲解另起一行。
`1. 炮二平五 …` 只记录红方这一着；`1. … 马８进７` 表示仅记录黑方这一着，须有该回合红方的连续来源。
支持 `…`、`……` 和 `...` 等省略号形式。省略的着法不会自动补全，缺少连续来源时后续内容会列入导入报告待核对。
