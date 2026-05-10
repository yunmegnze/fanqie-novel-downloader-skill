<img width="879" height="376" alt="image" src="https://github.com/user-attachments/assets/a87fd816-a0b5-4264-b01c-9466eae90723" />

<p align="center">
  <b>番茄小说下载器 —— Claude Code Skill</b><br/>
  提供番茄小说网页链接，自动下载原文到项目文件夹
</p>

---

## 功能

| 能力 | 说明 |
|------|------|
| 链接解析 | 从 fanqienovel.com 阅读链接自动提取书籍 ID |
| 章节下载 | 通过 Chrome CDP 浏览器自动化逐章下载，绕过付费墙 |
| 字体解码 | 自动解码番茄小说的自定义字体加密（PUA 映射 → 汉字） |
| 文件整理 | 按书名建立子文件夹，分章保存 TXT + 汇总 JSON |
| 跨项目复用 | 安装为用户级 skill，所有项目均可使用 |

## 前置条件

- **Node.js 22+**（无额外 npm 依赖，仅使用内置模块）
- **[web-access skill](https://github.com/eze-is/web-access)** — 提供 Chrome CDP proxy

## 安装

**方式一：npx skills（推荐）**

```bash
npx skills add yunmegnze/fanqie-novel-downloader
```

**方式二：让 Agent 安装**

```
帮我安装这个 skill：https://github.com/yunmegnze/fanqie-novel-downloader
```

**方式三：手动**

```bash
git clone https://github.com/yunmegnze/fanqie-novel-downloader ~/.claude/skills/fanqie-novel-downloader
```

## 使用

安装后直接给 Claude Code 番茄小说链接：

- "下载这本番茄小说的前 20 章：https://fanqienovel.com/reader/7624349898338484761"
- "把这个番茄小说的前 50 章下到 ./novels 文件夹：[URL]"

Skill 会自动触发，解析链接、检查 CDP 环境、逐章下载并解码保存。

## 技术原理

番茄小说的正文章节内容使用自定义字体加密：每个汉字被映射到 Unicode PUA 区域（U+E3E8-U+E563）的私有字符。阅读时通过 `@font-face` 加载专用字体文件渲染回正常汉字。

本 skill 使用 [fanqienovel-downloader](https://github.com/ying-ck/fanqienovel-downloader) 逆向得出的字符映射表（charset.json），将 PUA 字符直接解码回原始汉字，无需加载字体文件。

## 依赖

- [web-access](https://github.com/eze-is/web-access) — CDP 浏览器自动化
- [fanqienovel-downloader](https://github.com/ying-ck/fanqienovel-downloader) — 解码方案参考

## License

MIT
