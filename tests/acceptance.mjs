// Inkwell acceptance suite. Run: node tests/acceptance.mjs  (needs playwright + Chrome, python3, poppler-utils)
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FX = path.join(ROOT, 'tests/fixtures');
const OUT = path.join(ROOT, 'tests/out'); fs.mkdirSync(OUT, { recursive: true });
const EX = path.join(ROOT, 'examples');
const PORT = 8766, BASE = `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const results = [];
const rec = (id, name, pass, detail = '') => { results.push({ id, name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} ${detail}`); };
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const pdfPages = (f) => +/Pages:\s+(\d+)/.exec(sh('pdfinfo', [f]))[1];
const pdfSize = (f) => /Page size:\s+([\d.]+) x ([\d.]+)/.exec(sh('pdfinfo', [f])).slice(1).map(Number);
const read = (f) => fs.readFileSync(path.join(FX, f), 'utf8');
const countDelims = (md) => {
  // strip fenced + inline code, then count formula openers
  const t = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return {
    inline: (t.match(/(?<!\\)\\\(/g) || []).length,
    display: (t.match(/(?<!\\)\\\[/g) || []).length + ((t.match(/\$\$/g) || []).length / 2),
  };
};

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.errors = []; page.external = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('file:')) page.external.push(u); });
  return { ctx, page };
}
async function load(page, md) {
  await page.evaluate(() => localStorage.clear());
  await page.fill('#editor', md);
  await page.evaluate(() => window.inkwell.render());
  await page.waitForFunction(() => [...document.querySelectorAll('#doc img')].every((i) => i.complete), null, { timeout: 30000 });
}
async function printPdf(page, file) {
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
}
async function oneClick(page, file) {
  const r = await page.evaluate(async () => {
    const pdf = await window.inkwell.buildPdf();
    return { data: pdf.output('datauristring'), w: pdf.internal.pageSize.getWidth(), h: pdf.internal.pageSize.getHeight() };
  });
  fs.writeFileSync(file, Buffer.from(r.data.split(',')[1], 'base64'));
  return r;
}
const domStats = (page) => page.evaluate(() => {
  const d = document.querySelector('#doc');
  return {
    raw: (d.innerText.match(/\\\(|\\\)|\\\[|\\\]/g) || []).length,
    katex: d.querySelectorAll('.katex').length,
    display: d.querySelectorAll('.katex-display').length,
    errors: d.querySelectorAll('.katex-error').length,
    numbers: [...d.querySelectorAll('ol > li')].map((li) => li.value),
    imgs: [...d.querySelectorAll('img')].map((i) => i.naturalWidth),
    blanks: [...d.querySelectorAll('.underline-line')].filter((u) => u.getBoundingClientRect().width > 10).length,
    optionInList: [...d.querySelectorAll('li')].some((li) => /^[A-D]\.\s/.test(li.textContent)),
    fullwidth: (d.textContent.match(/\u3000/g) || []).length,
    text: d.textContent,
  };
});

/* ================= A. full exam sheet ================= */
{
  const md = read('exam-1023-full.md');
  const exp = countDelims(md);
  const expImgs = (md.match(/^>?\s*https?:\S+\.(jpe?g|png|gif|webp)\s*$/gm) || []).length;
  const expNums = (md.match(/^(\d+)\. /gm) || []).map((s) => parseInt(s));
  const expBlanks = (md.match(/\\underline\{\\hspace/g) || []).length;
  const { page } = await newPage();
  await page.goto(BASE);
  await load(page, md);
  const s = await domStats(page);
  rec('A1', 'Exam: no raw \\( \\) \\[ \\] left', s.raw === 0, `raw=${s.raw}`);
  rec('A2', 'Exam: all formulas rendered', s.katex === exp.inline + exp.display && s.display === exp.display, `katex=${s.katex}/${exp.inline + exp.display} (display ${s.display}/${exp.display})`);
  rec('A3', 'Exam: 0 KaTeX errors', s.errors === 0, `errors=${s.errors}`);
  rec('A4', 'Exam: question numbers 1–27 as typed', JSON.stringify(s.numbers) === JSON.stringify(expNums) && expNums.length === 27, `got ${s.numbers.join(',')}`);
  rec('A5', 'Exam: all images load', s.imgs.length === expImgs && s.imgs.every((w) => w > 0), `${s.imgs.filter((w) => w > 0).length}/${expImgs} loaded (fixture has ${expImgs}, not 9)`);
  rec('A6', 'Exam: answer blanks visible', s.blanks === expBlanks, `${s.blanks}/${expBlanks}`);
  rec('A7', 'Exam: A./B./C./D. lines stay text', !s.optionInList && /A\. 6个　　　B\. 7个/.test(s.text), '');
  const subs = (md.match(/（\d）/g) || []).length;
  rec('A8', 'Exam: （1）（2） sub-items intact', (s.text.match(/（\d）/g) || []).length === subs, `${(s.text.match(/（\d）/g) || []).length}/${subs}`);
  const fw = (md.match(/\u3000/g) || []).length;
  rec('A9', 'Exam: fullwidth spaces kept', s.fullwidth === fw, `${s.fullwidth}/${fw}`);
  await page.evaluate(() => { document.querySelector('#preview-scroll').scrollTop = 0; document.querySelector('#editor').scrollTop = 0; });
  await page.screenshot({ path: path.join(OUT, 'exam-full-preview.png') });
  const pp = path.join(EX, 'exam-full-print.pdf'), op = path.join(EX, 'exam-full-oneclick.pdf');
  await printPdf(page, pp);
  await oneClick(page, op);
  const np = pdfPages(pp), no = pdfPages(op);
  rec('A10', 'Exam: Print PDF + Download PDF produced', np >= 1 && no >= 1 && fs.statSync(pp).size > 10000 && fs.statSync(op).size > 10000, `print ${np} pages, one-click ${no} pages`);
  const txt = sh('pdftotext', [pp, '-']);
  const keys = ['周末复习卷', '杨辉', '详解九章算法', '长方形', 'BHFI', '平方差公式', '因式分解'];
  const missing = keys.filter((k) => !txt.replace(/\s+/g, '').includes(k));
  rec('A11', 'Exam: Print PDF text contains key Chinese strings', missing.length === 0, missing.length ? 'missing ' + missing.join(',') : keys.join(' '));
  rec('A12', 'Exam: no page errors', page.errors.length === 0, page.errors.join('; '));
  for (const [f, tag] of [[pp, 'p'], [op, 'o']]) sh('pdftoppm', ['-r', '45', '-png', f, path.join(OUT, 'exam-' + tag)]);
}

/* ================= B. math stress ================= */
{
  const md = read('math-stress.md');
  const { page } = await newPage();
  await page.goto(BASE);
  await load(page, md);
  const r = await page.evaluate(() => {
    const d = document.querySelector('#doc');
    const tex = (sel) => [...d.querySelectorAll(sel)].map((e) => e.getAttribute('data-tex'));
    return {
      katex: d.querySelectorAll('.katex').length,
      display: d.querySelectorAll('.katex-display').length,
      errors: d.querySelectorAll('.katex-error').length,
      matrix: !!d.querySelector('.katex .mtable'),
      cases: tex('[data-tex]').some((t) => t.includes('cases')),
      aligned: tex('[data-tex]').some((t) => t.includes('aligned')),
      nested: tex('[data-tex]').some((t) => t.includes('\\frac{1}{1+\\frac{1}{1+')),
      cjkInMath: [...d.querySelectorAll('.katex')].some((k) => k.textContent.includes('面积')),
      currency: /costs \$5 and \$10 per month, or \$ 20 total\. Price is USD\$30\./.test(d.textContent),
      tableMath: d.querySelectorAll('table .katex').length,
      tableCells: [...d.querySelectorAll('table tr')].map((tr) => tr.children.length),
      listMath: d.querySelectorAll('li .katex').length,
      quoteMath: d.querySelectorAll('blockquote .katex').length,
      quoteDisplayTex: tex('blockquote [data-tex]'),
      inlineCode: [...d.querySelectorAll('p code')].map((c) => c.textContent),
      codeBlock: d.querySelector('pre code')?.textContent || '',
      afterBroken: /should show an error/.test(d.textContent),
      escaped: /Escaped dollar \$ is literal/.test(d.textContent),
      stars: tex('.math-inline').includes('a*b*c'),
    };
  });
  rec('B1', 'Math: $ $$ \\( \\) \\[ \\] all render', r.katex === 19 && r.display === 6, `katex=${r.katex}/19 display=${r.display}/6 (mid-line $$…$$ renders in display mode, as on GitHub)`);
  rec('B2', 'Math: matrices / aligned / cases', r.matrix && r.aligned && r.cases, '');
  rec('B3', 'Math: nested fractions, roots, * and _ preserved', r.nested && r.stars, '');
  rec('B4', 'Math: \\text{中文} inside math', r.cjkInMath, '');
  rec('B5', 'Math: currency "$5 and $10" stays text', r.currency, '');
  rec('B6', 'Math: math inside table cells, table intact', r.tableMath === 2 && r.tableCells.every((n) => n === 3), `cells/row=${r.tableCells.join(',')}`);
  rec('B7', 'Math: math in list items and blockquotes', r.listMath === 3 && r.quoteMath === 2 && r.quoteDisplayTex.every((t) => !t.includes('>')), `list=${r.listMath} quote=${r.quoteMath} quoteTex=${JSON.stringify(r.quoteDisplayTex)}`);
  rec('B8', 'Math: inline code with \\( and $ untouched', r.inlineCode.includes('\\(not math\\)') && r.inlineCode.includes('$PATH and $HOME'), JSON.stringify(r.inlineCode));
  rec('B9', 'Math: LaTeX in code block untouched', r.codeBlock.includes('\\[ \\frac{a}{b} \\]') && r.codeBlock.includes('$y$'), '');
  rec('B10', 'Math: broken formula → inline error, no crash', r.errors === 1 && r.afterBroken && page.errors.length === 0, `errors=${r.errors}`);
  rec('B11', 'Math: escaped \\$ literal', r.escaped, '');
  await printPdf(page, path.join(OUT, 'math-stress.pdf'));
  sh('pdftoppm', ['-r', '60', '-png', '-f', '1', '-l', '1', '-singlefile', path.join(OUT, 'math-stress.pdf'), path.join(OUT, 'math-stress-p1')]);
}

/* ================= C. Markdown parity ================= */
{
  const md = read('parity.md');
  const { page } = await newPage();
  await page.goto(BASE);
  await load(page, md);
  await page.waitForSelector('#doc .mermaid-fig svg');
  const r = await page.evaluate(() => {
    const d = document.querySelector('#doc'), q = (s) => d.querySelectorAll(s).length;
    return {
      h: [1, 2, 3, 4, 5, 6].map((n) => q('h' + n)),
      fmt: q('strong') >= 2 && q('em') >= 2 && q('del') === 1,
      nested: q('ul ul ul') === 1 && q('ol ol') === 1,
      tasks: q('input[type=checkbox]') === 2 && q('input[type=checkbox]:checked') === 1,
      align: [...d.querySelectorAll('table th')].map((th) => th.getAttribute('align') || getComputedStyle(th).textAlign),
      hl: q('pre code.language-python .hljs-keyword') > 0,
      quote: q('blockquote blockquote') === 1, hr: q('hr') === 1,
      links: [...d.querySelectorAll('a[href^="https://example"]')].map((a) => a.target + '|' + a.rel),
      imgs: [...d.querySelectorAll('img[src^="http"]')].map((i) => i.naturalWidth > 0),
      emoji: q('.emoji') === 3 && d.textContent.includes('🚀'),
      html: !!d.querySelector('.custom-html kbd'),
      xss: !!(window.__xss || window.__xss2) || !!d.querySelector('script,[onerror]'),
      pb: q('.page-break') === 1, mermaid: q('.mermaid-fig svg') === 1 && d.querySelector('.mermaid-fig svg').textContent.includes('你好'),
    };
  });
  rec('C1', 'Parity: headings h1–h6', r.h.join(',') === '1,2,1,1,1,1', r.h.join(','));
  rec('C2', 'Parity: bold / italic / strike', r.fmt, '');
  rec('C3', 'Parity: nested lists (ul 3 levels, ol 2)', r.nested, '');
  rec('C4', 'Parity: task lists', r.tasks, '');
  rec('C5', 'Parity: table alignment', JSON.stringify(r.align) === '["left","center","right"]', JSON.stringify(r.align));
  rec('C6', 'Parity: code highlighting', r.hl, '');
  rec('C7', 'Parity: blockquote (nested) + hr', r.quote && r.hr, '');
  rec('C8', 'Parity: links (+ autolink, open in new tab, noopener)', r.links.length === 2 && r.links.every((l) => l === '_blank|noopener noreferrer'), r.links.join(' '));
  rec('C9', 'Parity: images (markdown + bare URL)', r.imgs.length === 2 && r.imgs.every(Boolean), JSON.stringify(r.imgs));
  rec('C10', 'Parity: emoji shortcodes + pasted emoji', r.emoji, '');
  rec('C11', 'Parity: HTML snippet kept, scripts/handlers stripped', r.html && !r.xss, `xss=${r.xss}`);
  const pf = path.join(OUT, 'parity.pdf');
  await printPdf(page, pf);
  const pg = Array.from({ length: pdfPages(pf) }, (_, i) => sh('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), pf, '-']).trim());
  const at = pg.findIndex((t) => t.startsWith('After page break'));
  rec('C12', 'Parity: page break → new page', at > 0 && !pg[at - 1].includes('After page break'), `"After page break" starts page ${at + 1} of ${pg.length}`);
  rec('C13', 'Parity: mermaid (with Chinese label)', r.mermaid, '');
  // long table + long document
  const rows = Array.from({ length: 150 }, (_, i) => `| ${i + 1} | 模型${i + 1} | \\(${i}.5\\) | ${(i * 0.37).toFixed(2)} |`).join('\n');
  const tableMd = `# Long table\n\n| # | 名称 | Input | Output |\n|---:|:--|:--:|--:|\n${rows}\n`;
  await load(page, tableMd);
  const tf = path.join(OUT, 'long-table.pdf');
  await printPdf(page, tf);
  const tp = pdfPages(tf);
  let headerPages = 0;
  for (let i = 1; i <= tp; i++) if (/#\s+名称\s+Input\s+Output/.test(sh('pdftotext', ['-layout', '-f', String(i), '-l', String(i), tf, '-']))) headerPages++;
  rec('C14', 'Long table spans pages, header repeats (Print)', tp >= 3 && headerPages === tp, `${tp} pages, header on ${headerPages}`);
  const exam = read('exam-1023-full.md').replace(/^>.*https:\/\/i\.ibb\.co.*$/gm, '');
  const longMd = Array.from({ length: 14 }, (_, i) => `# 第 ${i + 1} 套\n\n${exam}\n\n\\newpage\n`).join('\n') + tableMd;
  await load(page, longMd);
  const tRender = Math.round(await page.evaluate(() => new Promise((res) => { const t0 = performance.now(); window.inkwell.render(); requestAnimationFrame(() => setTimeout(() => res(performance.now() - t0), 0)); })));
  const lf = path.join(OUT, 'long.pdf');
  const t1 = Date.now(); await printPdf(page, lf); const tPrint = Date.now() - t1;
  const lp = pdfPages(lf);
  const t2 = Date.now();
  let oc = null, ocErr = '';
  try { await oneClick(page, path.join(OUT, 'long-oneclick.pdf')); oc = pdfPages(path.join(OUT, 'long-oneclick.pdf')); } catch (e) { ocErr = String(e.message).split('\n')[0]; }
  const tOne = Date.now() - t2;
  const lines = longMd.split('\n').length;
  rec('C15', 'Very long doc (30+ pages): render + Print timing', lp >= 30 && tRender < 5000 && tPrint < 30000, `${lines} lines, ${lp} pages; render→paint ${tRender} ms, print ${tPrint} ms`);
  rec('C16', 'Very long doc: one-click Download PDF', !!oc && oc >= 30 && tOne < 120000, oc ? `${oc} pages in ${tOne} ms` : 'failed: ' + ocErr);
  // typing latency on long doc
  const t3 = Date.now();
  await page.type('#editor', 'x'); await page.waitForTimeout(50);
  await page.evaluate(() => window.inkwell.render());
  rec('C17', 'Very long doc: re-render after edit', Date.now() - t3 < 3000, `${Date.now() - t3} ms`);
}

/* ================= D. options ================= */
{
  const { page } = await newPage();
  await page.goto(BASE);
  await load(page, read('exam-1023.md'));
  await page.click('#btn-settings');
  const set = async (o) => {
    for (const [k, v] of Object.entries(o)) {
      const el = '#opt-' + k;
      if (k === 'filename' || k === 'margin') await page.fill(el, String(v)); else await page.selectOption(el, String(v));
    }
  };
  const cases = [
    { size: 'A4', orient: 'portrait', exp: [595, 842] },
    { size: 'Letter', orient: 'portrait', exp: [612, 792] },
    { size: 'Letter', orient: 'landscape', exp: [792, 612] },
    { size: 'A4', orient: 'landscape', exp: [842, 595] },
  ];
  const near = (a, b) => Math.abs(a - b) < 2;
  for (const c of cases) {
    await set({ size: c.size, orient: c.orient });
    const f = path.join(OUT, `opt-${c.size}-${c.orient}.pdf`);
    await printPdf(page, f);
    const [w, h] = pdfSize(f);
    const o = await oneClick(page, f.replace('.pdf', '-1c.pdf'));
    const [w2, h2] = pdfSize(f.replace('.pdf', '-1c.pdf'));
    rec('D-' + c.size + '-' + c.orient, `Page ${c.size} ${c.orient} (Print + one-click)`, near(w, c.exp[0]) && near(h, c.exp[1]) && near(w2, c.exp[0]) && near(h2, c.exp[1]), `print ${w}x${h}, 1-click ${w2.toFixed(0)}x${h2.toFixed(0)} pt`);
  }
  await set({ size: 'A4', orient: 'portrait' });
  const xs = {};
  for (const m of [10, 30]) {
    await set({ margin: m });
    const f = path.join(OUT, `margin-${m}.pdf`);
    await printPdf(page, f);
    const bbox = sh('pdftotext', ['-bbox', '-f', '1', '-l', '1', f, '-']);
    xs[m] = Math.min(...[...bbox.matchAll(/xMin="([\d.]+)"/g)].map((x) => +x[1]));
  }
  const mm = (pt) => pt / 72 * 25.4;
  rec('D-margin', 'Margins honored (10 mm vs 30 mm)', Math.abs(mm(xs[10]) - 10) < 3 && Math.abs(mm(xs[30]) - 30) < 3, `left text edge ${mm(xs[10]).toFixed(1)} mm / ${mm(xs[30]).toFixed(1)} mm`);
  await set({ margin: 18 });
  await page.selectOption('#opt-font', '13');
  const fs13 = await page.evaluate(() => getComputedStyle(document.querySelector('#doc p')).fontSize);
  await page.selectOption('#opt-font', '10');
  const fs10 = await page.evaluate(() => getComputedStyle(document.querySelector('#doc p')).fontSize);
  rec('D-font', 'Font size option', fs13 === '17.3333px' && Math.abs(parseFloat(fs10) - 13.333) < 0.01, `13pt=${fs13}, 10pt=${fs10}`);
  await page.selectOption('#opt-theme', 'academic');
  const ff = await page.evaluate(() => getComputedStyle(document.querySelector('#doc')).fontFamily);
  rec('D-theme', 'Style option switches font (Academic = serif + CJK serif)', /Noto Serif CJK SC/.test(ff), '');
  await set({ filename: '周末复习卷-10.23' });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#btn-pdf')]);
  rec('D-filename', 'Filename honored in download (Chinese name)', dl.suggestedFilename() === '周末复习卷-10.23.pdf', dl.suggestedFilename());
  const title = await page.evaluate(() => { let t; const o = window.print; window.print = () => { t = document.title; }; document.querySelector('#btn-print').click(); return new Promise((r) => setTimeout(() => { window.print = o; r(t); }, 800)); });
  rec('D-printname', 'Print dialog default name = filename', title === '周末复习卷-10.23', String(title));
  await page.fill('#editor', '# 持久化测试 persist-42');
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#doc').textContent.includes('persist-42'));
  const pers = await page.evaluate(() => ({ f: document.querySelector('#opt-filename').value, t: document.querySelector('#opt-theme').value, s: document.querySelector('#opt-size').value, fs: document.querySelector('#opt-font').value }));
  rec('D-persist', 'localStorage persistence after reload (text + options)', pers.f === '周末复习卷-10.23' && pers.t === 'academic' && pers.fs === '10', JSON.stringify(pers));
  await page.setInputFiles('#file-input', path.join(FX, 'exam-1023-full.md'));
  await page.waitForFunction(() => document.querySelector('#doc').textContent.includes('BHFI'));
  rec('D-upload', '.md upload sets text + filename', (await page.inputValue('#opt-filename')) === 'exam-1023-full', await page.inputValue('#opt-filename'));
  const dropped = await page.evaluate(async () => {
    const dt = new DataTransfer();
    dt.items.add(new File(['# 拖放 dropped-ok'], 'drop.md', { type: 'text/markdown' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 600));
    return document.querySelector('#doc').textContent.includes('dropped-ok');
  });
  rec('D-drop', 'Drag-and-drop .md', dropped, '');
}

/* ================= E. edge cases ================= */
{
  const { page } = await newPage();
  await page.goto(BASE);
  await load(page, '');
  const ef = path.join(OUT, 'empty.pdf');
  let ok = true, msg = '';
  try { await printPdf(page, ef); await oneClick(page, path.join(OUT, 'empty-1c.pdf')); } catch (e) { ok = false; msg = e.message; }
  rec('E1', 'Empty document exports without crash', ok && page.errors.length === 0 && pdfPages(ef) === 1, msg || `print ${pdfPages(ef)} page`);
  const zh = '# 只有中文\n\n' + '这是一段只有中文的文字，用来测试中文字体、标点符号（全角）和换行是否正常。'.repeat(20);
  await load(page, zh);
  const zf = path.join(OUT, 'zh.pdf'); await printPdf(page, zf);
  const ztxt = sh('pdftotext', [zf, '-']).replace(/\s+/g, '');
  const fonts = sh('pdffonts', [zf]);
  rec('E2', 'Only Chinese text → CJK font embedded, text extractable', ztxt.includes('只有中文') && ztxt.includes('标点符号（全角）') && /CJK/.test(fonts), (fonts.match(/\S*CJK\S*/) || [''])[0]);
  // huge image generated locally (5000 x 9000)
  sh('python3', ['-c', `from PIL import Image, ImageDraw\nim=Image.new('RGB',(5000,9000),'#cde');d=ImageDraw.Draw(im)\nfor y in range(0,9000,500): d.rectangle([0,y,5000,y+40],fill='#246')\nim.save('${OUT}/huge.png')`]);
  await load(page, '# Huge image\n\nbefore\n\n![huge](tests/out/huge.png)\n\nafter 图片之后');
  const box = await page.evaluate(() => { const i = document.querySelector('#doc img'), d = document.querySelector('#doc'); const r = i.getBoundingClientRect(), dr = d.getBoundingClientRect(); return { w: r.width, h: r.height, docW: dr.width, nat: i.naturalWidth }; });
  const hf = path.join(OUT, 'huge.pdf'); await printPdf(page, hf);
  let hOk = true; try { await oneClick(page, path.join(OUT, 'huge-1c.pdf')); } catch { hOk = false; }
  rec('E3', 'Huge image (5000×9000) fits one page, no crash', box.nat === 5000 && box.w <= box.docW && pdfPages(hf) <= 2 && hOk && sh('pdftotext', [hf, '-']).includes('图片之后'), `shown ${box.w.toFixed(0)}x${box.h.toFixed(0)} px, print ${pdfPages(hf)} pages`);
  // network: full run of sample + exam should only touch user images
  const { page: p2 } = await newPage();
  await p2.goto(BASE);
  await p2.evaluate(() => localStorage.clear()); await p2.reload();
  await p2.waitForSelector('#doc .mermaid-fig svg', { state: 'attached' });
  await load(p2, read('exam-1023-full.md'));
  await oneClick(p2, path.join(OUT, 'net.pdf'));
  const ext = [...new Set(p2.external.map((u) => new URL(u).host))];
  rec('E4', 'No network requests except user images', ext.every((h) => h === 'i.ibb.co'), ext.join(',') || 'none');
  // fully offline from file://
  const { ctx: oc, page: p3 } = await newPage({ offline: true });
  await p3.goto('file://' + path.join(ROOT, 'index.html'));
  await p3.waitForSelector('#doc .mermaid-fig svg', { state: 'attached', timeout: 20000 });
  await load(p3, read('math-stress.md').replace(/^.*Broken formula.*$/m, ''));
  const off = await p3.evaluate(() => ({ k: document.querySelectorAll('#doc .katex').length, e: document.querySelectorAll('#doc .katex-error').length }));
  let offPdf = true; try { await oneClick(p3, path.join(OUT, 'offline.pdf')); } catch { offPdf = false; }
  rec('E5', 'Works fully offline from file:// (math, mermaid, PDF)', off.k > 10 && off.e === 0 && offPdf && p3.errors.length === 0, `katex=${off.k}`);
  // non-CORS / missing image fallback in one-click
  await load(p3, '# Missing image\n\nhttps://i.ibb.co/does-not-exist/zzz.jpg\n\ntext after');
  let fb = ''; try { await oneClick(p3, path.join(OUT, 'fallback.pdf')); fb = await p3.textContent('#toast'); } catch (e) { fb = 'ERR ' + e.message; }
  rec('E6', 'Unreachable image → placeholder, PDF still built', /image\(s\)/.test(fb), fb);
  await oc.close();
  // mobile
  const { page: m } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await m.goto(BASE); await m.click('#tab-preview'); await m.waitForTimeout(300);
  const mob = await m.evaluate(() => ({ over: document.documentElement.scrollWidth > window.innerWidth + 1, vis: document.querySelector('#doc').getBoundingClientRect().width > 0 }));
  rec('E7', 'Mobile 390px: preview tab, no horizontal overflow', !mob.over && mob.vis, '');
}

await browser.close();
server.kill();

/* ================= contact sheet + report ================= */
sh('python3', ['-c', `
import glob
from PIL import Image, ImageDraw
rows=[]
for tag,label in (('p','Print PDF'),('o','Download PDF')):
    files=sorted(glob.glob('${OUT}/exam-%s-*.png'%tag), key=lambda f:int(f.rsplit('-',1)[1][:-4]))
    rows.append((label,[Image.open(f).convert('RGB') for f in files]))
W=max(sum(i.width+12 for i in ims) for _,ims in rows)+12; H=sum(ims[0].height+40 for _,ims in rows)+12
sheet=Image.new('RGB',(W,H),'#d6d3cd'); d=ImageDraw.Draw(sheet); y=6
for label,ims in rows:
    d.text((12,y+6),label+'  (%d pages)'%len(ims),fill='black'); y+=28; x=12
    for n,im in enumerate(ims):
        sheet.paste(im,(x,y)); d.text((x+4,y+im.height-14),str(n+1),fill='#888'); x+=im.width+12
    y+=ims[0].height+12
sheet.save('${EX}/exam-full-pages.png')
`]);
const pass = results.filter((r) => r.pass).length;
const groups = { A: 'A. Full exam sheet', B: 'B. Math stress', C: 'C. Markdown parity & long docs', D: 'D. Options', E: 'E. Edge cases' };
let rep = `# Inkwell acceptance report\n\nRun: ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC · Chrome headless · **${pass}/${results.length} passed**\n\nRe-run: \`node tests/acceptance.mjs\`\n`;
for (const [g, title] of Object.entries(groups)) {
  rep += `\n## ${title}\n\n| ID | Case | Result | Detail |\n|---|---|---|---|\n`;
  for (const r of results.filter((x) => x.id.startsWith(g))) rep += `| ${r.id} | ${r.name.replace(/\|/g, '\\|')} | ${r.pass ? '✅ pass' : '❌ FAIL'} | ${String(r.detail).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |\n`;
}
rep += `\n## Artifacts\n\n- examples/exam-full-print.pdf, examples/exam-full-oneclick.pdf\n- examples/exam-full-pages.png (every page of both PDFs, for checking that no formula or image is split)\n- tests/out/ (scratch PDFs and renders, git-ignored)\n`;
const NOTES = `
## Bugs found by this suite and fixed

1. **Download PDF cut text lines in half at page edges.** The one-click export slices one tall canvas, so the bottom of a line landed on one page and the top on the next. Fixed by making paragraphs, list items, inline formulas, figures and headings unbreakable (\`pagebreak.avoid\` in app.js). Checked by eye on page joins of examples/exam-full-oneclick.pdf.
2. **Multi-line display math inside a blockquote** (\`> \\[\` … \`> \\]\`) carried the \`>\` markers into the TeX. These are now stripped before KaTeX sees the formula (B7).
3. **Huge images** could be taller than a page. Images are now capped at the page's content height and keep their aspect ratio (E3).

## Notes and known limits

- The full exam fixture has **7** images (Q6 ×1, Q18 ×4, Q27 ×2), not 9.
- A \`$$…$$\` in the middle of a line renders as display math (centred on its own line), which matches GitHub.
- The one-click Download PDF is an image of each page, so its text can't be selected. Print → "Save as PDF" gives selectable vector text, and the text checks run on that file.
- Long tables: the header row repeats on every page in Print. In the one-click PDF, rows are never cut, but the header is not repeated.
- Timing (this box): 2,548-line / 62-page document renders in under 1 s, Print PDF in about 2 s, and one-click PDF in about 16 s. Typing 85 KB into the textarea in headless Chrome is slow (about 5 s), but a bare \`<textarea>\` is just as slow, so the cost isn't in Inkwell.
- Indented (4-space) code blocks are not protected from math parsing. Fenced code blocks and inline code are.
`;
fs.writeFileSync(path.join(ROOT, 'tests/REPORT.md'), rep + NOTES);
console.log(`\n${pass}/${results.length} passed`);
process.exitCode = pass === results.length ? 0 : 1;
