# Inkwell acceptance report

Run: 2026-10-23 13:16 UTC · Chrome headless · **59/59 passed**

Re-run: `node tests/acceptance.mjs`

## A. Full exam sheet

| ID | Case | Result | Detail |
|---|---|---|---|
| A1 | Exam: no raw \( \) \[ \] left | ✅ pass | raw=0 |
| A2 | Exam: all formulas rendered | ✅ pass | katex=114/114 (display 6/6) |
| A3 | Exam: 0 KaTeX errors | ✅ pass | errors=0 |
| A4 | Exam: question numbers 1–27 as typed | ✅ pass | got 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27 |
| A5 | Exam: all images load | ✅ pass | 7/7 loaded (fixture has 7, not 9) |
| A6 | Exam: answer blanks visible | ✅ pass | 15/15 |
| A7 | Exam: A./B./C./D. lines stay text | ✅ pass |  |
| A8 | Exam: （1）（2） sub-items intact | ✅ pass | 11/11 |
| A9 | Exam: fullwidth spaces kept | ✅ pass | 54/54 |
| A10 | Exam: Print PDF + Download PDF produced | ✅ pass | print 5 pages, one-click 5 pages |
| A11 | Exam: Print PDF text contains key Chinese strings | ✅ pass | 周末复习卷 杨辉 详解九章算法 长方形 BHFI 平方差公式 因式分解 |
| A12 | Exam: no page errors | ✅ pass |  |

## B. Math stress

| ID | Case | Result | Detail |
|---|---|---|---|
| B1 | Math: $ $$ \( \) \[ \] all render | ✅ pass | katex=19/19 display=6/6 (mid-line $$…$$ renders in display mode, as on GitHub) |
| B2 | Math: matrices / aligned / cases | ✅ pass |  |
| B3 | Math: nested fractions, roots, * and _ preserved | ✅ pass |  |
| B4 | Math: \text{中文} inside math | ✅ pass |  |
| B5 | Math: currency "$5 and $10" stays text | ✅ pass |  |
| B6 | Math: math inside table cells, table intact | ✅ pass | cells/row=3,3,3 |
| B7 | Math: math in list items and blockquotes | ✅ pass | list=3 quote=2 quoteTex=["\\sqrt{2}\\approx1.414","e^{i\\pi}+1=0"] |
| B8 | Math: inline code with \( and $ untouched | ✅ pass | ["\\(not math\\)","$PATH and $HOME"] |
| B9 | Math: LaTeX in code block untouched | ✅ pass |  |
| B10 | Math: broken formula → inline error, no crash | ✅ pass | errors=1 |
| B11 | Math: escaped \$ literal | ✅ pass |  |

## C. Markdown parity & long docs

| ID | Case | Result | Detail |
|---|---|---|---|
| C1 | Parity: headings h1–h6 | ✅ pass | 1,2,1,1,1,1 |
| C2 | Parity: bold / italic / strike | ✅ pass |  |
| C3 | Parity: nested lists (ul 3 levels, ol 2) | ✅ pass |  |
| C4 | Parity: task lists | ✅ pass |  |
| C5 | Parity: table alignment | ✅ pass | ["left","center","right"] |
| C6 | Parity: code highlighting | ✅ pass |  |
| C7 | Parity: blockquote (nested) + hr | ✅ pass |  |
| C8 | Parity: links (+ autolink, open in new tab, noopener) | ✅ pass | _blank\|noopener noreferrer _blank\|noopener noreferrer |
| C9 | Parity: images (markdown + bare URL) | ✅ pass | [true,true] |
| C10 | Parity: emoji shortcodes + pasted emoji | ✅ pass |  |
| C11 | Parity: HTML snippet kept, scripts/handlers stripped | ✅ pass | xss=false |
| C12 | Parity: page break → new page | ✅ pass | "After page break" starts page 3 of 3 |
| C13 | Parity: mermaid (with Chinese label) | ✅ pass |  |
| C14 | Long table spans pages, header repeats (Print) | ✅ pass | 6 pages, header on 6 |
| C15 | Very long doc (30+ pages): render + Print timing | ✅ pass | 2548 lines, 62 pages; render→paint 532 ms, print 1577 ms |
| C16 | Very long doc: one-click Download PDF | ✅ pass | 62 pages in 15261 ms |
| C17 | Very long doc: re-render after edit | ✅ pass | 339 ms |

## D. Options

| ID | Case | Result | Detail |
|---|---|---|---|
| D-A4-portrait | Page A4 portrait (Print + one-click) | ✅ pass | print 594.96x841.92, 1-click 595x842 pt |
| D-Letter-portrait | Page Letter portrait (Print + one-click) | ✅ pass | print 612x792, 1-click 612x792 pt |
| D-Letter-landscape | Page Letter landscape (Print + one-click) | ✅ pass | print 792x612, 1-click 792x612 pt |
| D-A4-landscape | Page A4 landscape (Print + one-click) | ✅ pass | print 841.92x594.96, 1-click 842x595 pt |
| D-margin | Margins honored (10 mm vs 30 mm) | ✅ pass | left text edge 10.1 mm / 29.9 mm |
| D-font | Font size option | ✅ pass | 13pt=17.3333px, 10pt=13.3333px |
| D-theme | Style option switches font (Academic = serif + CJK serif) | ✅ pass |  |
| D-filename | Filename honored in download (Chinese name) | ✅ pass | 周末复习卷-10.23.pdf |
| D-printname | Print dialog default name = filename | ✅ pass | 周末复习卷-10.23 |
| D-persist | localStorage persistence after reload (text + options) | ✅ pass | {"f":"周末复习卷-10.23","t":"academic","s":"A4","fs":"10"} |
| D-upload | .md upload sets text + filename | ✅ pass | exam-1023-full |
| D-drop | Drag-and-drop .md | ✅ pass |  |

## E. Edge cases

| ID | Case | Result | Detail |
|---|---|---|---|
| E1 | Empty document exports without crash | ✅ pass | print 1 page |
| E2 | Only Chinese text → CJK font embedded, text extractable | ✅ pass | AAAAAA+NotoSansCJKsc-Bold |
| E3 | Huge image (5000×9000) fits one page, no crash | ✅ pass | shown 466x838 px, print 2 pages |
| E4 | No network requests except user images | ✅ pass | i.ibb.co |
| E5 | Works fully offline from file:// (math, mermaid, PDF) | ✅ pass | katex=18 |
| E6 | Unreachable image → placeholder, PDF still built | ✅ pass | 1 image(s) block cross-site export — shown as links. Use Print to include them. |
| E7 | Mobile 390px: preview tab, no horizontal overflow | ✅ pass |  |

## Artifacts

- examples/exam-full-print.pdf, examples/exam-full-oneclick.pdf
- examples/exam-full-pages.png (every page of both PDFs, for checking that no formula or image is split)
- tests/out/ (scratch PDFs and renders, git-ignored)

## Bugs found by this suite and fixed

1. **Download PDF cut text lines in half at page edges.** The one-click export slices one tall canvas, so the bottom of a line landed on one page and the top on the next. Fixed by making paragraphs, list items, inline formulas, figures and headings unbreakable (`pagebreak.avoid` in app.js). Checked by eye on page joins of examples/exam-full-oneclick.pdf.
2. **Multi-line display math inside a blockquote** (`> \[` … `> \]`) carried the `>` markers into the TeX. These are now stripped before KaTeX sees the formula (B7).
3. **Huge images** could be taller than a page. Images are now capped at the page's content height and keep their aspect ratio (E3).

## Notes and known limits

- The full exam fixture has **7** images (Q6 ×1, Q18 ×4, Q27 ×2), not 9.
- A `$$…$$` in the middle of a line renders as display math (centred on its own line), which matches GitHub.
- The one-click Download PDF is an image of each page, so its text can't be selected. Print → "Save as PDF" gives selectable vector text, and the text checks run on that file.
- Long tables: the header row repeats on every page in Print. In the one-click PDF, rows are never cut, but the header is not repeated.
- Timing (this box): 2,548-line / 62-page document renders in under 1 s, Print PDF in about 2 s, and one-click PDF in about 16 s. Typing 85 KB into the textarea in headless Chrome is slow (about 5 s), but a bare `<textarea>` is just as slow, so the cost isn't in Inkwell.
- Indented (4-space) code blocks are not protected from math parsing. Fenced code blocks and inline code are.
