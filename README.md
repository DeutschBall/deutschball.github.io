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

全站右下角的“♫ 音乐”打开网易云外链播放器，支持两首歌切换和停止。首次打开音乐面板时才载入播放器；自动播放是否成功由浏览器和网易云决定。

切换文章会中断页内播放；使用“独立窗口播放”可在阅读其他文章时持续播放。外链播放器不提供本页可用的曲终事件，因此当前是手动切歌，不自动连播。

曲目在 `docs/music/player.html` 的下拉选项中维护，`value` 为网易云歌曲 ID，显示文字可自行改成歌名。播放能力和地区/版权限制由网易云决定。

启动本地预览后，运行 `npm run test:music` 检查音乐控件；该测试模拟网易云响应，不验证音源实际播放。
