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

## 背景音乐

右下角悬浮窗默认展开，完整保留网易云 iframe 的歌曲信息、播放/暂停和进度条。点击“♫ 音乐”收起或展开，不重新加载 iframe。每次页面加载从列表随机挑选一首，尝试自动播放；浏览器若拦截，请点击网易云播放器内的播放按钮。切换文章会重新随机选曲。

音乐列表位于 `docs/javascripts/music.js` 顶部的 `tracks` 数组。添加网易云 iframe 外链中 `id=` 后面的歌曲 ID 即可，每个 ID 用引号包裹、逗号分隔，例如：

```javascript
const tracks = ['3448038585', '1918901957', '新歌曲ID'];
```

外链可用性受网易云版权、地区和网络状态影响。启动本地预览后，运行 `npm run test:music` 检查随机选曲、iframe 交互和悬浮窗收起/展开；测试用模拟嵌入页面验证交互，不验证网易云在线歌曲可用性。
