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

可通过 `BLOG_URL` 改变测试站点地址。浏览器测试先访问真实云库，再通过受控响应验证异常状态。断言覆盖走子、悔棋、历史回看、翻转坐标、导入错误隔离、FEN 导出、推荐落子、390px 窄屏无横向溢出、断网继续操作、未知数据、旧响应隔离、困毙、其他页面不发起云库请求及页面脚本错误。截图默认写入系统临时目录。

规则测试包含初始局面 perft 1–3（44 / 1920 / 79666）、特殊走子规则、将军、将死、困毙、FEN 和 API 解析/缓存/超时。

## 发布

沿用仓库现有 GitHub Actions：合入 main 后部署 GitHub Pages。先检查本地测试与构建结果，再审阅变更发布。外部云库不保证任意局面有数据；前端不补造分值，不启动后台计算。

协议参考：

- https://www.chessdb.cn/cloudbook_api.html
- https://www.chessdb.cn/cloudbook_info.html
- https://www.xqbase.com/protocol/cchess_move.htm
- https://www.xqbase.com/protocol/cchess_fen.htm
