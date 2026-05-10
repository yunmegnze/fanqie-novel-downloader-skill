#!/usr/bin/env node
/**
 * 番茄小说下载器
 * 用法: node download.mjs <bookId> <outputDir> [chapterCount]
 *
 * 依赖: web-access skill 提供的 CDP proxy (localhost:3456)
 * 参考: https://github.com/ying-ck/fanqienovel-downloader
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ============ 参数解析 ============

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('用法: node download.mjs <bookId> <outputDir> [chapterCount]');
  process.exit(1);
}

const bookId = args[0];
const outputDir = path.resolve(args[1]);
const chapterCount = parseInt(args[2]) || 20;

// ============ 常量 ============

const CDP_PROXY = 'http://localhost:3456';
const CODE = [[58344, 58715], [58345, 58716]];
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// ============ 工具函数 ============

function sanitizeFilename(name) {
  const map = {
    '<': '＜', '>': '＞', ':': '：', '"': '＂',
    '/': '／', '\\': '＼', '|': '｜', '?': '？', '*': '＊'
  };
  return name.replace(/[<>:"\/\\|?*]/g, c => map[c] || c);
}

function decodeContent(raw, charset, mode = 0) {
  let result = '';
  for (const char of raw) {
    const uni = char.charCodeAt(0);
    if (uni >= CODE[mode][0] && uni <= CODE[mode][1]) {
      const bias = uni - CODE[mode][0];
      if (bias >= 0 && bias < charset[mode].length && charset[mode][bias] !== '?') {
        result += charset[mode][bias];
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
}

function garbledRatio(text) {
  if (!text) return 1;
  let g = 0;
  for (const c of text) {
    const code = c.charCodeAt(0);
    if (code >= 58344 && code <= 58716) g++;
    if (code < 32 && code !== 10 && code !== 13) g++;
  }
  return g / text.length;
}

function curl(url, opts = {}) {
  const timeout = opts.timeout || 15;
  const method = opts.method || 'GET';
  let cmd = `curl -s --max-time ${timeout}`;
  if (method === 'POST') {
    cmd += ` -X POST -d ${JSON.stringify(opts.body || '')}`;
  }
  cmd += ` ${JSON.stringify(url)}`;
  try {
    return execSync(cmd, { timeout: (timeout + 5) * 1000, encoding: 'utf8' });
  } catch {
    return '';
  }
}

function cdpApi(endpoint, opts = {}) {
  const url = `${CDP_PROXY}${endpoint}`;
  return curl(url, opts);
}

// ============ 主流程 ============

async function main() {
  console.log(`番茄小说下载器`);
  console.log(`bookId: ${bookId}`);
  console.log(`输出目录: ${outputDir}`);
  console.log(`章节数: ${chapterCount}`);
  console.log();

  // 加载字符映射表
  const charsetPath = path.join(SCRIPT_DIR, 'charset.json');
  if (!fs.existsSync(charsetPath)) {
    console.error('错误: 未找到 charset.json，请确保文件存在于 ' + charsetPath);
    process.exit(1);
  }
  const charset = JSON.parse(fs.readFileSync(charsetPath, 'utf8'));

  // 获取书名和章节目录
  console.log('正在获取章节目录...');
  const pageHtml = curl(`https://fanqienovel.com/page/${bookId}`);
  if (!pageHtml) {
    console.error('错误: 无法访问小说页面，请检查 bookId 是否正确');
    process.exit(1);
  }

  // 提取书名
  const titleMatch = pageHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const bookTitle = titleMatch ? titleMatch[1].trim() : 'Unknown';
  console.log(`书名: 《${bookTitle}》`);

  // 提取章节列表
  const chapterRegex = /<a href="\/reader\/(\d+)" class="chapter-item-title"[^>]*>([^<]+)<\/a>/g;
  const allChapters = [];
  let match;
  while ((match = chapterRegex.exec(pageHtml)) !== null) {
    allChapters.push({ id: match[1], title: match[2].trim() });
  }
  console.log(`总章节数: ${allChapters.length}`);

  if (allChapters.length === 0) {
    console.error('错误: 未找到任何章节');
    process.exit(1);
  }

  const chapters = allChapters.slice(0, chapterCount);
  console.log(`将下载前 ${chapters.length} 章`);
  console.log();

  // 创建输出文件夹
  const safeName = sanitizeFilename(bookTitle);
  const bookDir = path.join(outputDir, safeName);
  if (!fs.existsSync(bookDir)) {
    fs.mkdirSync(bookDir, { recursive: true });
  }

  // 逐章下载
  const allContent = {};
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const idx = String(i + 1).padStart(2, '0');
    const readerUrl = `https://fanqienovel.com/reader/${ch.id}`;

    process.stdout.write(`[${idx}/${chapters.length}] ${ch.title} ... `);

    try {
      // 步骤1: 创建 CDP tab
      const newResult = JSON.parse(cdpApi(`/new?url=${encodeURIComponent(readerUrl)}`));
      const targetId = newResult.targetId;

      // 步骤2: 提取内容
      const evalScript = `(()=>{const d=document.querySelector(".muye-reader-content.noselect");if(!d)return JSON.stringify({error:"not found"});const ps=d.querySelectorAll("p");const arr=[];for(const p of ps){const t=p.textContent.trim();if(t)arr.push(t)}return JSON.stringify({count:arr.length,content:arr.join("\\n"),total:arr.reduce((s,t)=>s+t.length,0)})})()`;

      const evalResult = JSON.parse(cdpApi('/eval?target=' + targetId, {
        method: 'POST', body: evalScript
      }));
      const pageData = JSON.parse(evalResult.value);

      // 步骤3: 关闭 tab
      cdpApi('/close?target=' + targetId);

      if (pageData.error || pageData.total === 0) {
        throw new Error(pageData.error || '内容为空');
      }

      // 步骤4: 解码
      let decoded = decodeContent(pageData.content, charset, 0);
      const gr0 = garbledRatio(decoded);
      if (gr0 > 0.02) {
        const decoded1 = decodeContent(pageData.content, charset, 1);
        if (garbledRatio(decoded1) < gr0) {
          decoded = decoded1;
        }
      }

      // 步骤5: 保存
      const safeTitle = sanitizeFilename(ch.title);
      const txtPath = path.join(bookDir, `${idx}_${safeTitle}.txt`);
      fs.writeFileSync(txtPath, `${ch.title}\n\n${decoded}\n`, 'utf8');

      allContent[ch.title] = decoded;
      successCount++;
      console.log(`OK (${decoded.length} 字)`);

    } catch (err) {
      errors.push({ title: ch.title, error: err.message });
      console.log(`FAIL: ${err.message}`);
    }
  }

  // 保存汇总 JSON
  const jsonPath = path.join(bookDir, `${safeName}_前${chapterCount}章.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(allContent, null, 2), 'utf8');

  // 输出结果
  console.log();
  console.log(`========================================`);
  console.log(`下载完成！`);
  console.log(`书名: 《${bookTitle}》`);
  console.log(`成功: ${successCount}/${chapters.length} 章`);
  if (errors.length > 0) {
    console.log(`失败: ${errors.length} 章`);
    for (const e of errors) {
      console.log(`  - ${e.title}: ${e.error}`);
    }
  }
  console.log(`保存位置: ${bookDir}`);
  console.log(`汇总JSON: ${jsonPath}`);
}

main().catch(err => {
  console.error('下载器异常:', err.message);
  process.exit(1);
});
