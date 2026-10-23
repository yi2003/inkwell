/* Inkwell — client-side Markdown → PDF. No network calls, no tracking. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const editor = $('#editor'), doc = $('#doc'), scroller = $('#preview-scroll');
  const STORE_DOC = 'inkwell.doc.v1', STORE_OPT = 'inkwell.opts.v1';
  const PAGE_MM = { A4: [210, 297], Letter: [215.9, 279.4], Legal: [215.9, 355.6], A5: [148, 210] };

  /* ---------- options ---------- */
  const defaults = { filename: 'document', size: 'A4', orient: 'portrait', margin: 18, theme: 'clean', font: 11, pagenum: true };
  let opts = { ...defaults, ...safeJSON(localStorage.getItem(STORE_OPT)) };
  function safeJSON(s) { try { return JSON.parse(s) || {}; } catch { return {}; } }
  const optEls = {
    filename: $('#opt-filename'), size: $('#opt-size'), orient: $('#opt-orient'),
    margin: $('#opt-margin'), theme: $('#opt-theme'), font: $('#opt-font'), pagenum: $('#opt-pagenum'),
  };
  for (const [k, el] of Object.entries(optEls)) {
    if (el.type === 'checkbox') el.checked = !!opts[k]; else el.value = opts[k];
    el.addEventListener('input', () => {
      opts[k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? clamp(+el.value || 0, 0, 50) : el.value);
      localStorage.setItem(STORE_OPT, JSON.stringify(opts));
      applyPage();
    });
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function pageDims() {
    let [w, h] = PAGE_MM[opts.size] || PAGE_MM.A4;
    if (opts.orient === 'landscape') [w, h] = [h, w];
    return { w, h, m: clamp(+opts.margin, 0, 50) };
  }
  function applyPage() {
    const { w, h, m } = pageDims();
    doc.className = 'doc theme-' + opts.theme;
    doc.style.setProperty('--page-w', w + 'mm');
    doc.style.setProperty('--page-h', h + 'mm');
    doc.style.setProperty('--page-m', m + 'mm');
    doc.style.setProperty('--fs', opts.font + 'pt');
    $('#page-rule').textContent = `@page { size: ${opts.size} ${opts.orient}; margin: ${m}mm; }`;
    $('#page-label').textContent = `${opts.size} · ${opts.orient} · ${m} mm`;
    fitPaper();
  }
  // Scale the paper down on narrow screens so it never overflows.
  function fitPaper() {
    doc.style.zoom = '';
    const avail = scroller.clientWidth - 24;
    const natural = doc.offsetWidth;
    if (natural > avail && avail > 0) doc.style.zoom = (avail / natural).toFixed(3);
  }
  window.addEventListener('resize', fitPaper);

  /* ---------- markdown pipeline ---------- */
  const EMOJI = {
    smile: '😄', grin: '😁', joy: '😂', wink: '😉', heart: '❤️', thumbsup: '👍', '+1': '👍', thumbsdown: '👎', '-1': '👎',
    rocket: '🚀', tada: '🎉', fire: '🔥', star: '⭐', sparkles: '✨', warning: '⚠️', white_check_mark: '✅', heavy_check_mark: '✔️',
    x: '❌', bulb: '💡', memo: '📝', book: '📖', bug: '🐛', zap: '⚡', eyes: '👀', point_right: '👉', question: '❓',
    exclamation: '❗', lock: '🔒', key: '🔑', calendar: '📅', chart_with_upwards_trend: '📈', moneybag: '💰', gear: '⚙️',
    hourglass: '⌛', coffee: '☕', pushpin: '📌', link: '🔗', information_source: 'ℹ️', no_entry: '⛔', construction: '🚧',
    100: '💯', clap: '👏', pray: '🙏', thinking: '🤔', sob: '😭', ok_hand: '👌', wave: '👋', muscle: '💪', cn: '🇨🇳', us: '🇺🇸',
  };
  /* Math is pulled out of the source BEFORE marked runs, replaced by private-use placeholders,
     so marked never sees (and never "un-escapes") the backslashes, _ * ^ | inside formulas.
     Supported: \[ … \]  $$ … $$  (display, may span lines)  and  \( … \)  $ … $  (inline). */
  const PH_OPEN = '\uE000', PH_CLOSE = '\uE001';
  const IMG_EXT = /\.(?:jpe?g|png|gif|webp|svg|avif|bmp)(?:\?[^\s]*)?$/i;
  function protectMath(src) {
    const store = [];
    const put = (tex, display) => { store.push({ tex: tex.trim(), display }); return PH_OPEN + (store.length - 1) + PH_CLOSE; };
    // Multi-line math inside "> " quotes or indented list items: drop the per-line quote markers.
    const unquote = (tex, whole, offset) => {
      if (!tex.includes('\n')) return tex;
      const lineStart = whole.lastIndexOf('\n', offset - 1) + 1;
      const prefix = /^[ \t]*(?:>[ \t]?)+/.exec(whole.slice(lineStart, offset));
      return prefix ? tex.replace(/\n[ \t]*(?:>[ \t]?)+/g, '\n') : tex;
    };
    const out = [];
    // Walk line by line so fenced code blocks are left untouched.
    const parts = src.split(/(^ {0,3}(?:```|~~~)[^\n]*\n[\s\S]*?(?:^ {0,3}(?:```|~~~)[ \t]*$|(?![\s\S])))/m);
    parts.forEach((chunk, i) => {
      if (i % 2 === 1) { out.push(chunk); return; } // fenced code
      // keep inline code spans intact
      const segs = chunk.split(/((?<!`)`+)([\s\S]*?[^`])\1(?!`)/);
      let text = '';
      for (let j = 0; j < segs.length; j++) {
        if (j % 3 === 1) { text += segs[j] + segs[j + 1] + segs[j]; j++; continue; }
        text += segs[j]
          .replace(/(?<!\\)\\\[([\s\S]+?)\\\]/g, (_, t, o, w) => put(unquote(t, w, o), true))
          .replace(/(?<!\\)\$\$([\s\S]+?)\$\$/g, (_, t, o, w) => put(unquote(t, w, o), true))
          .replace(/(?<!\\)\\\(([\s\S]+?)\\\)/g, (_, t) => put(t, false))
          .replace(/(?<![\\$\w])\$(?![\s$\d])((?:\\.|[^\\$\n])+?)(?<!\s)\$(?![\d$])/g, (_, t) => put(t, false));
      }
      // Bare image URL alone on a line (optionally inside "> " quotes) → linked image.
      text = text.replace(/^((?:[ \t]*>)*[ \t]*)(https?:\/\/[^\s<>()]+?)([ \t]*)$/gm, (m, pre, url, tail) =>
        IMG_EXT.test(url) ? `${pre}[![image](${url})](${url})` : m);
      out.push(text);
    });
    return { text: out.join(''), store };
  }
  function restoreMath(html, store) {
    return html.replace(/\uE000(\d+)\uE001/g, (m, n) => {
      const item = store[+n]; if (!item) return m;
      return item.display
        ? `<span class="math-block" data-tex="${esc(item.tex)}"></span>`
        : `<span class="math-inline" data-tex="${esc(item.tex)}"></span>`;
    });
  }
  const emoji = {
    name: 'emoji', level: 'inline',
    start: (src) => { const i = src.search(/:[a-z0-9_+-]+:/); return i < 0 ? undefined : i; },
    tokenizer(src) {
      const m = /^:([a-z0-9_+-]+):/.exec(src);
      if (m && EMOJI[m[1]]) return { type: 'emoji', raw: m[0], text: EMOJI[m[1]] };
    },
    renderer: (t) => `<span class="emoji">${t.text}</span>`,
  };
  const pageBreak = {
    name: 'pageBreak', level: 'block',
    start: (src) => src.match(/^\\(newpage|pagebreak)\s*$/m)?.index,
    tokenizer(src) {
      const m = /^\\(?:newpage|pagebreak) *(?:\n+|$)/.exec(src);
      if (m) return { type: 'pageBreak', raw: m[0] };
    },
    renderer: () => '<div class="page-break"></div>\n',
  };
  function esc(s) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  const md = new marked.Marked(
    markedHighlight.markedHighlight({
      emptyLangClass: 'hljs', langPrefix: 'hljs language-',
      highlight(code, lang) {
        if (lang === 'mermaid') return esc(code);
        const l = hljs.getLanguage(lang) ? lang : null;
        try { return l ? hljs.highlight(code, { language: l }).value : hljs.highlightAuto(code).value; } catch { return esc(code); }
      },
    }),
    { gfm: true, breaks: false, extensions: [emoji, pageBreak] },
  );

  // Keep the author's own numbers: marked merges "7." "15." "21." separated by blank lines into
  // one list and renumbers them 7, 8, 9…; an explicit value attribute pins each item's number.
  md.use({
    renderer: {
      listitem(item) {
        const html = marked.Renderer.prototype.listitem.call(this, item);
        const n = /^ {0,3}(\d{1,9})[.)]/.exec(item.raw || '');
        return n ? html.replace(/^<li/, `<li value="${+n[1]}"`) : html;
      },
    },
  });

  mermaid.initialize({
    startOnLoad: false, securityLevel: 'strict', theme: 'neutral',
    fontFamily: 'Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
    htmlLabels: false, flowchart: { htmlLabels: false }, // plain SVG text → survives canvas capture + sanitizer
  });

  let renderSeq = 0, mermaidId = 0;
  const mermaidCache = new Map();
  async function render() {
    const seq = ++renderSeq;
    const src = editor.value;
    const prot = protectMath(src);
    const raw = restoreMath(md.parse(prot.text), prot.store);
    const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'form'] });
    const tmp = document.createElement('div');
    tmp.innerHTML = clean;
    tmp.querySelectorAll('[data-tex]').forEach((el) => {
      try { katex.render(el.getAttribute('data-tex'), el, { displayMode: el.classList.contains('math-block'), throwOnError: false, output: 'html' }); }
      catch (e) { el.textContent = el.getAttribute('data-tex'); el.classList.add('math-error'); }
    });
    tmp.querySelectorAll('a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    const blocks = [...tmp.querySelectorAll('pre > code.language-mermaid')];
    for (const code of blocks) {
      const text = code.textContent;
      const fig = document.createElement('figure');
      fig.className = 'mermaid-fig';
      if (mermaidCache.has(text)) fig.innerHTML = mermaidCache.get(text);
      else {
        try {
          const { svg } = await mermaid.render('mmd-' + (++mermaidId), text);
          const safe = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['style'] });
          mermaidCache.set(text, safe);
          if (mermaidCache.size > 50) mermaidCache.delete(mermaidCache.keys().next().value);
          fig.innerHTML = safe;
        } catch (e) {
          fig.innerHTML = `<pre class="mermaid-error">Diagram error: ${esc(String(e.message || e).split('\n')[0])}</pre>`;
          document.querySelectorAll('[id^="dmmd-"]').forEach((n) => n.remove());
        }
      }
      code.parentElement.replaceWith(fig);
      if (seq !== renderSeq) return; // a newer render started
    }
    if (seq !== renderSeq) return;
    doc.replaceChildren(...tmp.childNodes);
    if (!src.trim()) doc.innerHTML = '<p class="empty">Your document preview appears here.</p>';
    updateStats(src);
    document.body.dataset.rendered = String(seq);
  }
  function updateStats(src) {
    const cjk = (src.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) || []).length;
    const words = (src.replace(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, ' ').match(/\S+/g) || []).length + cjk;
    $('#stats').textContent = `${words.toLocaleString()} words · ${src.length.toLocaleString()} chars`;
  }

  let timer;
  editor.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { render(); save(); }, 180);
  });
  function save() { try { localStorage.setItem(STORE_DOC, editor.value); } catch {} }

  // Tab key inserts two spaces instead of leaving the editor.
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); toast('Saved in this browser'); }
  });

  // Proportional scroll sync editor → preview.
  editor.addEventListener('scroll', () => {
    const r = editor.scrollTop / Math.max(1, editor.scrollHeight - editor.clientHeight);
    scroller.scrollTop = r * (scroller.scrollHeight - scroller.clientHeight);
  });

  /* ---------- files ---------- */
  function loadText(text, name) {
    editor.value = text;
    if (name) { opts.filename = name.replace(/\.[^.]+$/, '') || 'document'; optEls.filename.value = opts.filename; localStorage.setItem(STORE_OPT, JSON.stringify(opts)); }
    render(); save();
  }
  function readFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('File is larger than 5 MB');
    if (!/\.(md|markdown|mdown|txt)$/i.test(file.name) && !/^text\//.test(file.type)) return toast('Please choose a Markdown or text file');
    const r = new FileReader();
    r.onload = () => { loadText(String(r.result), file.name); toast(`Opened ${file.name}`); };
    r.readAsText(file);
  }
  $('#file-input').addEventListener('change', (e) => { readFile(e.target.files[0]); e.target.value = ''; });
  const overlay = $('#drop-overlay');
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { if ([...e.dataTransfer.types].includes('Files')) { dragDepth++; overlay.classList.add('show'); } });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; overlay.classList.remove('show'); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; overlay.classList.remove('show'); readFile(e.dataTransfer.files[0]); });

  $('#btn-sample').onclick = () => {
    if (editor.value.trim() && !confirm('Replace the current text with the sample?')) return;
    loadText($('#sample-md').textContent.replace(/^\n/, ''), 'sample');
  };
  $('#btn-clear').onclick = () => { if (!editor.value || confirm('Clear the editor?')) { loadText(''); editor.focus(); } };
  $('#btn-settings').onclick = (e) => {
    const s = $('#settings'); s.hidden = !s.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!s.hidden));
    fitPaper();
  };

  /* ---------- export ---------- */
  const fname = (ext) => (opts.filename || 'document').replace(/[\\/:*?"<>|]+/g, '_').trim() + ext;

  // Path 1: browser print → selectable text, uses @page size/margins.
  $('#btn-print').onclick = async () => {
    await render();
    const old = document.title;
    document.title = fname(''); // browsers use the title as the default PDF name
    window.addEventListener('afterprint', () => { document.title = old; }, { once: true });
    window.print();
  };

  // Path 2: one-click download via html2pdf (canvas-based).
  async function buildPdf() {
    await render();
    if (!window.html2pdf) throw new Error('PDF library still loading, try again');
    const { w, h, m } = pageDims();
    const holder = document.createElement('div');
    holder.className = 'pdf-holder';
    const clone = doc.cloneNode(true);
    clone.id = '';
    clone.style.zoom = '';
    clone.classList.add('for-pdf');
    clone.style.width = (w - 2 * m) + 'mm';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
      await document.fonts.ready;
      const blocked = await prepareImages(clone);
      if (blocked) toast(`${blocked} image(s) block cross-site export — shown as links. Use Print to include them.`);
      const worker = html2pdf().set({
        margin: m,
        filename: fname('.pdf'),
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: getComputedStyle(clone).backgroundColor || '#fff', logging: false },
        jsPDF: { unit: 'mm', format: [w, h].sort((a, b) => a - b), orientation: opts.orient },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['p', 'li', 'tr', 'pre', 'blockquote', 'figure', '.math-block', '.katex', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.mermaid-fig', '.img-fallback'] },
      }).from(clone).toPdf();
      const pdf = await worker.get('pdf');
      if (opts.pagenum) {
        const n = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= n; i++) {
          pdf.setPage(i); pdf.setFontSize(9); pdf.setTextColor(140);
          pdf.text(`${i} / ${n}`, w / 2, h - Math.max(4, m / 2.5), { align: 'center' });
        }
      }
      return pdf;
    } finally { holder.remove(); }
  }

  // html2canvas can only draw cross-origin images served with CORS headers. Probe each image with
  // crossOrigin=anonymous; if it can't be read, swap in a labelled placeholder instead of failing.
  async function prepareImages(root) {
    let blocked = 0;
    await Promise.all([...root.querySelectorAll('img')].map((img) => new Promise((resolve) => {
      const src = img.getAttribute('src') || '';
      if (/^(data:|blob:)/.test(src) || new URL(src, location.href).origin === location.origin) return resolve();
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      let fired = false;
      const done = (ok) => {
        if (fired) return; fired = true;
        if (ok) { try { const c = document.createElement('canvas'); c.width = c.height = 1; c.getContext('2d').drawImage(probe, 0, 0); c.toDataURL(); } catch { ok = false; } }
        if (ok) { img.crossOrigin = 'anonymous'; img.src = probe.src; }
        else {
          blocked++;
          const ph = document.createElement('div');
          ph.className = 'img-fallback';
          ph.textContent = '🖼 Image: ' + src;
          img.replaceWith(ph);
        }
        resolve();
      };
      probe.onload = () => done(true); probe.onerror = () => done(false);
      setTimeout(() => done(false), 8000);
      probe.src = src;
    })));
    return blocked;
  }
  const pdfBtn = $('#btn-pdf');
  pdfBtn.onclick = async () => {
    pdfBtn.disabled = true; const label = pdfBtn.querySelector('span').textContent;
    pdfBtn.querySelector('span').textContent = 'Building…';
    try { const pdf = await buildPdf(); pdf.save(fname('.pdf')); toast('PDF downloaded'); }
    catch (e) { console.error(e); toast('Could not build PDF: ' + e.message); }
    finally { pdfBtn.disabled = false; pdfBtn.querySelector('span').textContent = label; }
  };
  window.inkwell = { buildPdf, render }; // used by automated tests

  // Standalone HTML export (inlines no external assets except KaTeX CSS rules already in page).
  $('#btn-html').onclick = async () => {
    await render();
    const css = [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(fname(''))}</title><style>${css}</style></head><body class="standalone"><article class="${doc.className}" style="${doc.getAttribute('style') || ''}">${doc.innerHTML}</article></body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = fname('.html'); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  /* ---------- mobile tabs ---------- */
  const ws = $('#workspace');
  for (const [id, view] of [['#tab-edit', 'edit'], ['#tab-preview', 'preview']]) {
    $(id).onclick = () => {
      ws.dataset.view = view;
      $('#tab-edit').setAttribute('aria-selected', String(view === 'edit'));
      $('#tab-preview').setAttribute('aria-selected', String(view === 'preview'));
      requestAnimationFrame(fitPaper);
    };
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- boot ---------- */
  const saved = localStorage.getItem(STORE_DOC);
  editor.value = saved !== null ? saved : $('#sample-md').textContent.replace(/^\n/, '');
  applyPage();
  render();
})();
