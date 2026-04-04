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
