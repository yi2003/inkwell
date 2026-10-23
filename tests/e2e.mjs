import { chromium } from 'playwright';
import fs from 'fs';
const out = './tests/out'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const reqs = []; page.on('request', r => { if (!r.url().startsWith('http://localhost:8765')) reqs.push(r.url()); });
await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
await page.waitForSelector('#doc .mermaid-fig svg', { timeout: 20000 });
const checks = await page.evaluate(() => ({
  katex: document.querySelectorAll('#doc .katex').length,
  mermaidSvg: document.querySelectorAll('#doc .mermaid-fig svg').length,
  mermaidText: document.querySelector('#doc .mermaid-fig svg').textContent,
  hljs: document.querySelectorAll('#doc pre code .hljs-keyword').length,
  tables: document.querySelectorAll('#doc table').length,
  tasks: document.querySelectorAll('#doc input[type=checkbox]').length,
  emoji: document.querySelectorAll('#doc .emoji').length,
  pagebreaks: document.querySelectorAll('#doc .page-break').length,
  chinese: document.querySelector('#doc').textContent.includes('中文排版'),
  cjkFont: getComputedStyle(document.querySelector('#doc p')).fontFamily.includes('Noto Sans CJK SC'),
}));
console.log('DOM checks', JSON.stringify(checks));
await page.screenshot({ path: './screenshot.png' });
// live preview: type text
await page.fill('#editor', (await page.inputValue('#editor')) + '\n\n测试实时预览 live-check-123\n');
await page.waitForFunction(() => document.querySelector('#doc').textContent.includes('live-check-123'));
console.log('live preview OK');
const saved = await page.evaluate(() => localStorage.getItem('inkwell.doc.v1')?.includes('live-check-123'));
console.log('autosave', saved);
// settings: filename + Letter
await page.click('#btn-settings');
await page.fill('#opt-filename', 'sample-test');
await page.selectOption('#opt-size', 'A4');
// one-click download
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#btn-pdf')]);
console.log('download name', dl.suggestedFilename());
await dl.saveAs(out + '/download.pdf');
// print path (same as browser Save as PDF)
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: out + '/print.pdf', preferCSSPageSize: true, printBackground: true });
await page.emulateMedia({ media: 'screen' });
// mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage(); await mp.goto('http://localhost:8765/'); await mp.waitForSelector('#doc .mermaid-fig svg', { state: 'attached' });
await mp.screenshot({ path: out + '/mobile-edit.png' }); await mp.click('#tab-preview'); await mp.waitForTimeout(300);
await mp.screenshot({ path: out + '/mobile-preview.png' });
// upload test
const f = out + '/up.md'; fs.writeFileSync(f, '# Uploaded 上传测试\n\nhello');
await page.setInputFiles('#file-input', f);
await page.waitForFunction(() => document.querySelector('#doc h1')?.textContent.includes('上传测试'));
console.log('upload OK, filename now', await page.inputValue('#opt-filename'));
console.log('external requests', reqs.length, reqs.slice(0,5));
console.log('errors', errors);
await browser.close();
