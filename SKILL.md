---
name: fanqie-novel-downloader
description: 番茄小说下载器。输入番茄小说网页链接，下载小说原文到项目文件夹。触发场景：用户提供 fanqienovel.com 链接并要求下载、保存小说章节内容。
triggers:
  - fanqienovel.com
  - 番茄小说
  - 下载小说
  - 下载章节
---

# 番茄小说下载器

## 前置条件

需要 **web-access skill** 的 CDP proxy 已运行。检查方式：

```bash
node "${CLAUDE_SKILL_DIR}/web-access/scripts/check-deps.mjs"
```

未通过时引导用户先安装 web-access skill。

## 使用流程

### 1. 解析 URL

用户提供的番茄小说链接格式为 `https://fanqienovel.com/reader/{chapterId}`。从该 chapter ID 的 reader 页面提取真正的 `bookId`。

通过 curl 获取 reader 页面，正则提取 `"bookId":"(\\d+)"`。

### 2. 下载执行

```bash
node "${CLAUDE_SKILL_DIR}/fanqie-novel-downloader/scripts/download.mjs" <bookId> <outputDir> [chapterCount]
```

参数：
- `bookId`：从 reader 页面提取的书籍 ID
- `outputDir`：输出目录（建议使用用户指定的项目文件夹）
- `chapterCount`：下载章节数，默认 20

脚本行为：
- 从 `https://fanqienovel.com/page/{bookId}` 获取书名和章节目录
- 在 outputDir 下创建以书名命名的子文件夹
- 通过 CDP proxy 逐章下载（绕过付费墙）
- 自动解码番茄小说的自定义字体加密
- 保存为 `{序号}_{章节名}.txt` + 书名汇总 JSON
- 任务完成后关闭自己创建的 CDP tab

### 3. 结果汇报

下载完成后，告知用户：
- 书名和作者
- 下载章节数 / 总章节数
- 保存位置
- 如有失败章节，列出并说明原因

## 技术说明

- 下载通过 Chrome CDP 浏览器自动化实现，天然携带用户登录态
- 内容使用 charset.json 解码番茄小说的自定义字体映射（Unicode PUA 区域 → 汉字）
- 不需要任何 npm 依赖，仅使用 Node.js 内置模块 + curl
- 解码方案参考 [fanqienovel-downloader](https://github.com/ying-ck/fanqienovel-downloader)
