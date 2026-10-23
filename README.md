# Inkwell — Markdown → PDF (static, client-side)

Write Markdown on the left and see it laid out as a page on the right, then export a PDF. Everything runs in the browser. There is no backend, no analytics and no CDN calls, because all libraries are vendored in `vendor/`.

## Run locally
    python3 -m http.server 8000      # then open http://localhost:8000
(Opening `index.html` directly from disk also works in most browsers.)

## Features
- Live split editor/preview. On phones it switches to Write/Preview tabs and the page scales to fit.
- GFM: tables with alignment, task lists, strikethrough, autolinks, raw HTML (sanitized with DOMPurify)
- Syntax highlighting (highlight.js), KaTeX math (`$…$`, `$$…$$`), Mermaid diagrams (```mermaid)
- Emoji shortcodes (`:rocket:`) and pasted emoji. CJK text uses PingFang / YaHei / Noto CJK fallbacks.
- Page breaks: `\newpage`, `\pagebreak` or `<div class="page-break"></div>`
- Open a .md file or drag and drop one. Autosave to localStorage. Ctrl/Cmd+S saves.
- Page settings: A4 / Letter / Legal / A5, portrait or landscape, margins in mm, 4 document styles, font size, file name
- Export:
  - **Download PDF**: a one-click file made with html2pdf.js, with page numbers. Pages are images, so the text is not selectable.
  - **Print**: the browser's "Save as PDF", using `@page` size and margins. The text is selectable and searchable and the file is smaller. Backgrounds print automatically.
  - **HTML**: a standalone .html file.

## Tests
    npm i playwright && node tests/e2e.mjs   # needs the server on :8765, and Chrome at /usr/bin/google-chrome

## Licenses
The vendored libraries are MIT or BSD licensed. See `vendor/LICENSE-*`.
