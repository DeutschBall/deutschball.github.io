# 首页象棋分析

首页的「棋局研究室」是原生 JavaScript 组件，随 MkDocs 静态站点发布，无需 Node 构建、后端或访问密钥。页面布局参考常见象棋分析界面，分析结果来自中国象棋云库，不运行皮卡鱼引擎。

## 使用

运行 `mkdocs serve --dev-addr 127.0.0.1:8001` 后访问首页。点击己方棋子，再点击标记位置走棋；推荐着法可直接落子，悬停可查看起止位置。支持翻转、悔棋、历史回看、FEN 导入导出。回看后走棋会截断后续变化；重新开局或导入 FEN 会清空记录。记录保留在当前页面内，刷新不持久化。

FEN 支持两字段和六字段形式，马/象接受 N/B 或 H/E，输出统一使用 N/B。坐标固定为红方视角 a0–i9，不随棋盘翻转改变。禁止非法走法、送将、将帅照面；将死和困毙均判行棋方负。支持基本走棋规则，不自动裁定长将、长捉及重复局面；重复三次时提示人工判断。不是完整赛事裁判系统。

## 实现

- `docs/javascripts/xiangqi/rules.mjs`：局面、合法着法、FEN 和中文着法。
- `docs/javascripts/xiangqi/cloud.mjs`：云库文本解析、缓存、超时和取消。
- `docs/javascripts/xiangqi/app.mjs`：棋盘、历史及分析面板。
- `docs/javascripts/xiangqi-loader.js`：只在存在首页容器时加载组件，兼容 Material 即时导航。
- `docs/stylesheets/xiangqi.css`：限定于组件的样式、明暗主题与窄屏布局。

云库端点为 `https://www.chessdb.cn/chessdb.php`，查询 `queryall` 与 `querypv`，显式传入 `learn=0` 和 `egtbmetric=dtm`。不会调用 queue、请求自动学习或自动对弈。FEN 通过 URLSearchParams 编码；未知评分保留为未知，分值使用云库原值，不冒充兵值或实战统计胜率。评分与评估胜率显示为当前行棋方视角；最佳标记使用云库 rank=2。主变化逐步验证合法性再展示。

研究室折叠块沿用 MkDocs Material 的 details/summary 样式及箭头，FEN 标题简写为“FEN”。

着法记录和我的博客棋谱支持展开、收起，默认展开；切换局面和异步加载不会改变其折叠状态。

云库分析默认折叠，首次展开才查询当前局面；折叠时取消等待和进行中的请求，折叠期间走子不查询，再次展开按当前局面查询（可命中缓存）。

300ms 防抖、10 秒超时、60 秒缓存（最多 128 条查询）、AbortController 与请求版本检查防止旧结果覆盖。浏览器网络断开或接口故障时棋盘仍可使用。API 字段以 textContent 输出，避免把远端文本作为 HTML。

2026-10-24 接入验证：HTTPS 返回 200；服务器对 `http://127.0.0.1:8001` 及 `https://dustball.top` Origin 返回匹配的 Access-Control-Allow-Origin。Chrome 在本地首页直接获取了 44 个候选着法及主变化。当前不需要代理。上线后仍应从真实站点浏览器复验；第三方跨域策略可能变化。如未来必须代理，应单独部署 HTTPS 代理并限制 action、请求大小、超时及来源，GitHub Pages 本身不能执行代理。

## 验证

```sh
node --test tests/xiangqi.test.mjs
mkdocs build
```

浏览器验收需要 Playwright、已安装的 Google Chrome 和运行中的本地预览。Playwright 是测试工具，不属于网站运行依赖。可将其安装到独立目录：

```sh
npm install --prefix /tmp/dustland-browser playwright
PLAYWRIGHT_MODULE=/tmp/dustland-browser/node_modules/playwright/index.mjs node tests/xiangqi.browser.mjs
```

折叠按需查询验收：`PLAYWRIGHT_MODULE=/tmp/dustland-browser/node_modules/playwright/index.mjs node tests/cloud-lazy.browser.mjs`，检查默认零请求、折叠走子零请求、展开查询当前局面及收起取消。

可通过 `BLOG_URL` 改变测试站点地址。浏览器测试先访问真实云库，再通过受控响应验证异常状态。断言覆盖走子、悔棋、历史回看、翻转坐标、导入错误隔离、FEN 导出、推荐落子、390px 窄屏无横向溢出、断网继续操作、未知数据、旧响应隔离、困毙、其他页面不发起云库请求及页面脚本错误。截图默认写入系统临时目录。

规则测试包含初始局面 perft 1–3（44 / 1920 / 79666）、特殊走子规则、将军、将死、困毙、FEN 和 API 解析/缓存/超时。

## 发布

沿用仓库现有 GitHub Actions：合入 main 后部署 GitHub Pages。先检查本地测试与构建结果，再审阅变更发布。外部云库不保证任意局面有数据；前端不补造分值，不启动后台计算。

协议参考：

- https://www.chessdb.cn/cloudbook_api.html
- https://www.chessdb.cn/cloudbook_info.html
- https://www.xqbase.com/protocol/cchess_move.htm
- https://www.xqbase.com/protocol/cchess_fen.htm

## 博客棋谱库试点

研究室按棋盘、云库分析、着法记录、我的博客棋谱的顺序等宽纵向排列。首篇样例《中炮盘头马有时可以弃马保中兵@2026.6.22》：文章主线 20 手；“黑棋弃马冲中卒”分支从第 19 手后分叉、回放总计 22 手。首篇样例索引 24 个不同局面。均是片段，不补造文章未记录的后续。文章属于复盘资料，但不能仅凭文章断言每一步都是作者实战，故标注“文中主线，实战归属待核实”。散文中的未编号建议不自动纳入。

- 命中以棋子位置与行棋方匹配，忽略 FEN 计数器，不做镜像或红黑交换。
- 同一棋局反复到达同一局面只计 1 局，记录全部命中手数；不同棋局分别计数。
- 分析分支独立统计，分叉之前共享的主线前缀不再计入分析命中。
- 覆盖率目前为 50/56 篇内容文章，分母不含目录首页和 tags.md。未收录不等于未出现。
- 主线/分支可载入研究室并用历史按钮回放；每篇匹配文章标题旁提供“跳转文章”和“摆上棋谱”两个按钮，不再嵌套棋谱目录折叠。仅显示当前局面命中的棋局与分支；同篇文章有多个匹配分支时可选择分支再摆上棋谱。
- 棋谱数据独立于云库；加载成功后，断网仍能查询。首次加载失败会明确提示并提供重试，不将失败显示为零命中。

### 添加或修正棋谱

`data/chess/games.json` 是经过核对的来源清单。每局使用稳定 ID，主线与变着保留原文行号和逐字快照。文章不被改写。`scripts/build-chess-library.mjs` 将中文着法与当前所有合法着法逐一匹配，仅接受唯一结果，保留中文名称、来源行、坐标着法和起始 FEN。支持数字全半角与仕/士、马/馬文字等价；不修改棋子实际位置。出现非法着法、歧义、回合断裂、来源行变化时失败，要求人工复核。

```sh
node scripts/build-chess-library.mjs
node scripts/build-chess-library.mjs --check
node --test tests/*.test.mjs
mkdocs build
```

生成的 `docs/assets/xiangqi/library.json` 随静态网站提交。MkDocs 直接使用此文件，无运行时后端。新增文章或修改来源后需重新生成并提交；GitHub Actions 会验证索引是否过期并运行规则和棋谱测试。未来批量转换应先建立复核记录；同一对局跨文章出现需合并到同一个 gameId，而不是按文章数量冒充对局数量。

浏览器验收（沿用上文 Playwright 安装方式）：

```sh
PLAYWRIGHT_MODULE=/tmp/dustland-browser/node_modules/playwright/index.mjs node tests/library.browser.mjs
```

验证覆盖原文链接 HTTP 200、走子/悔棋/FEN 联动、完整样例载入、分支不计入主线、断网查询、窄屏布局、库失败/重试。全部规则和棋谱测试共 17 项。

### 第二批收录（2026-10-24）

第二批当时共 5 篇文章、5 条主线片段、8 条分析分支，索引 123 个唯一局面。所有收录的编号着法通过逐步合法性校验。非编号散文、图片及缺失后续不作猜测补全。

| 文章 | 主线手数 | 分析分支数 |
| --- | ---: | ---: |
| 中炮盘头马有时可以弃马保中兵@2026.6.22 | 20 | 1 |
| 中炮对屏风马@2026.5.29 | 19 | 1 |
| 中炮盘头马何时冲中兵@2026.6.10 | 15 | 2 |
| 中炮两头蛇不出车应对对小列炮@2026.6.13 | 4 | 2 |
| 应对反宫马仕角炮打串@2026.10.4 | 6 | 2 |

### 棋谱检索与 FEN 编辑

来源复核信息保留在数据和本文档中，界面仅显示匹配统计、文章链接与棋谱载入入口，不再显示来源归属说明或每条命中的“第几手 · 回放”按钮。

FEN 输入框随走子、悔棋、历史回看、重置、棋谱载入与成功导入同步更新。明暗主题下均为白底深色文字，可以直接编辑或粘贴后点击导入。折叠切换与异步查询不覆盖编辑中的内容；非法导入保留输入及原棋盘。

## Full-site import (2026-10-24)

All 56 content articles were scanned. 50 articles yielded legally replayable numbered sequences: 149 mainline fragments, 249 variations and 3,324 distinct positions. Monthly compilations are split by their level-two headings; variations in a study article remain attached to its source record. These are source records, not independently verified real-world games. Identical openings alone are insufficient evidence to merge different articles into a single game.

33 articles have unresolved numbered lines. Valid prefixes are retained, but missing or illegal moves are never invented to continue a line. Six articles lack reconstructible numbered sequences: the April 2026 compilation, the central-cannon/opposite-cannon positional essay, the five-six-cannon external-link directory, the empty screen-horse summary, the pawn-opening image summary, and the image-based `疑形与攻击` essay. They remain in the audit rather than being counted as empty games.

`CHESS_IMPORT_REPORT.md` and `data/chess/import-audit.json` record every article, source line and unresolved issue. Their counts include dependent lines that cannot be replayed after an earlier failure, not just independent errors.

```sh
node scripts/import-blog-chess.mjs
node scripts/build-chess-library.mjs
node scripts/build-chess-library.mjs --check
node --test tests/*.test.mjs
mkdocs build
```

The importer preserves manually reviewed samples. Other numbered lines are interpreted using heading, indentation, admonition and quotation context. Parenthesized numbering, full-width digits, split black turns and trailing ellipses are supported. Move numbers and turn must agree with the source prefix. It does not modify original articles. A source row may retain only its first move via `take`; `branchPly` records the actual divergence independently of the replay prefix, preventing shared prefixes from inflating variation counts.

The build checks the complete article inventory and source-content hashes. Rerun import and review after articles are added, removed or edited. Resolving the remaining issues requires corrected source moves or explicit starting FENs; automated legality checking does not replace editorial review.

Validation: 19 tests; every imported line replayed; browser checks for all 50 article URLs, 149 initial matches, representative mainline/variation loading, FEN synchronization, offline lookup, mobile overflow and load-error recovery. No remote deployment has been performed.
