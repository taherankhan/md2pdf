import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { parseMarkdown } from './markdownParser';
import { getTheme, applyThemeToHTML } from '../themes/themeConfig';
import Prism from 'prismjs';
import {
  PdfExportError,
  PDF_EXPORT_TIMEOUT_MS,
  PDF_MAX_CANVAS_PIXELS,
  PDF_MAX_MARKDOWN_CHARS,
} from './pdfErrors';
import {
  MERMAID_DIAGRAM_STYLES,
  renderMermaidInDocument,
  waitForMermaidPaint,
} from './renderMermaidInDocument';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new PdfExportError(
            'EXPORT_TIMEOUT',
            'PDF export timed out. Try a shorter document or fewer images.'
          )
        ),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function assertCanvasWithinLimits(canvas: HTMLCanvasElement): void {
  const pixels = canvas.width * canvas.height;
  if (pixels > PDF_MAX_CANVAS_PIXELS) {
    throw new PdfExportError(
      'MEMORY_LIMIT',
      `Document renders too large for direct PDF export. Try "Print to PDF (Vector)" from the export menu (render size: ${Math.round(pixels / 1_000_000)}M pixels).`
    );
  }
}

export interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_PDF_MARGINS: PdfMargins = {
  top: 15,
  right: 15,
  bottom: 15,
  left: 15,
};

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const MM_TO_PX = 794 / 210; // ~3.78095 px per mm at 96 DPI

const isHeadingElement = (el: HTMLElement): boolean => /^H[1-6]$/i.test(el.tagName);

/**
 * Converts images in the sandbox document to Base64 to prevent cross-origin canvas errors.
 */
async function processSandboxImages(doc: Document): Promise<void> {
  const images = doc.querySelectorAll('img');
  const imagePromises = Array.from(images).map(async (img) => {
    const originalSrc = img.src;
    if (!originalSrc || originalSrc.startsWith('data:')) return;

    try {
      const response = await fetch(originalSrc);
      const blob = await response.blob();
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (base64Data) {
        img.src = base64Data;
        img.removeAttribute('crossorigin');
      }
    } catch {
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalSrc)}`;
        const res = await fetch(proxyUrl);
        const blob = await res.blob();
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (base64Data) {
          img.src = base64Data;
          img.removeAttribute('crossorigin');
        }
      } catch {
        img.crossOrigin = 'anonymous';
      }
    }
  });

  await Promise.race([
    Promise.all(imagePromises),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);
}

/**
 * Paged DOM Layout Engine:
 * Partitions the rendered document into discrete, pixel-exact A4 page containers before rendering.
 *
 * Guarantees:
 * 1. Zero horizontal slicing through text lines or diagrams.
 * 2. Zero orphan headings (headings automatically carry over to the new page with their following block).
 * 3. Atomic diagrams are auto-constrained to fit A4 printable height.
 * 4. Code blocks and tables split cleanly at line/row boundaries when space allows, eliminating white gaps.
 * 5. Full 4-sided margins applied identically to every single page.
 */
function layoutContentIntoA4Pages(
  sandboxDoc: Document,
  sourceContentEl: HTMLElement,
  theme: any,
  margins: PdfMargins,
  smartPageBreaks: boolean = true
): HTMLElement[] {
  const padTop = Math.max(0, Math.round((margins.top ?? 15) * MM_TO_PX));
  const padRight = Math.max(0, Math.round((margins.right ?? 15) * MM_TO_PX));
  const padBottom = Math.max(0, Math.round((margins.bottom ?? 15) * MM_TO_PX));
  const padLeft = Math.max(0, Math.round((margins.left ?? 15) * MM_TO_PX));

  const printableHeightPx = Math.max(200, A4_HEIGHT_PX - padTop - padBottom);

  // Auto-constrain any Mermaid diagram SVGs so they never exceed printable page height
  const mermaidBlocks = Array.from(sourceContentEl.querySelectorAll<HTMLElement>('.mermaid'));
  for (const m of mermaidBlocks) {
    const svg = m.querySelector('svg');
    if (svg) {
      const maxSvgHeight = printableHeightPx - 30;
      svg.style.maxHeight = `${maxSvgHeight}px`;
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
      svg.style.width = 'auto';
    }
  }

  // Create pages root container
  const pagesContainer = sandboxDoc.createElement('div');
  pagesContainer.id = 'paged-render-root';
  pagesContainer.style.width = `${A4_WIDTH_PX}px`;
  pagesContainer.style.position = 'relative';
  sandboxDoc.body.appendChild(pagesContainer);

  const pages: HTMLElement[] = [];

  function createA4Page(): { pageEl: HTMLElement; contentEl: HTMLElement } {
    const pageIndex = pages.length + 1;
    const pageEl = sandboxDoc.createElement('div');
    pageEl.className = 'pdf-dom-a4-page';
    pageEl.setAttribute('data-page-index', String(pageIndex));
    pageEl.style.width = `${A4_WIDTH_PX}px`;
    pageEl.style.height = `${A4_HEIGHT_PX}px`;
    pageEl.style.minHeight = `${A4_HEIGHT_PX}px`;
    pageEl.style.maxHeight = `${A4_HEIGHT_PX}px`;
    pageEl.style.boxSizing = 'border-box';
    pageEl.style.padding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
    pageEl.style.position = 'relative';
    pageEl.style.backgroundColor = theme.colors.background || '#ffffff';
    pageEl.style.color = theme.colors.text || '#1f2937';
    pageEl.style.overflow = 'hidden';
    pageEl.style.margin = '0 0 20px 0';

    const pageContentEl = sandboxDoc.createElement('div');
    pageContentEl.className = 'pdf-dom-a4-content';
    pageContentEl.style.width = '100%';
    pageContentEl.style.height = `${printableHeightPx}px`;
    pageContentEl.style.maxHeight = `${printableHeightPx}px`;
    pageContentEl.style.boxSizing = 'border-box';
    pageContentEl.style.overflow = 'hidden';

    pageEl.appendChild(pageContentEl);
    pagesContainer.appendChild(pageEl);
    pages.push(pageEl);

    return { pageEl, contentEl: pageContentEl };
  }

  // Collect top-level child elements
  const rawNodes = Array.from(sourceContentEl.childNodes);
  const elements: HTMLElement[] = [];

  for (const node of rawNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      elements.push(node as HTMLElement);
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const p = sandboxDoc.createElement('p');
      p.textContent = node.textContent;
      elements.push(p);
    }
  }

  const queue: HTMLElement[] = [...elements];
  let cur = createA4Page();
  let iterationCount = 0;
  const MAX_ITERATIONS = Math.max(1000, elements.length * 8);

  while (queue.length > 0 && iterationCount++ < MAX_ITERATIONS) {
    const item = queue.shift()!;

    // Test append
    cur.contentEl.appendChild(item);

    // Check overflow (+2px tolerance for sub-pixel layout rounding)
    const overflows = cur.contentEl.scrollHeight > printableHeightPx + 2;

    if (!overflows) {
      continue;
    }

    // Overflow occurred: remove item from current page
    cur.contentEl.removeChild(item);

    // If current page is empty, we must keep the item to avoid infinite loops
    if (cur.contentEl.children.length === 0) {
      cur.contentEl.appendChild(item);
      cur = createA4Page();
      continue;
    }

    const currentHeight = cur.contentEl.scrollHeight;
    const remainingPx = printableHeightPx - currentHeight;

    // 1. Orphan Heading Prevention:
    // Only move a heading if cur page already has other content prior to the heading.
    // If cur page has only 1 child (the heading itself), it is already at the top of a fresh page,
    // so moving it again would cause an infinite loop!
    const lastChild = cur.contentEl.lastElementChild as HTMLElement | null;
    if (cur.contentEl.children.length > 1 && lastChild && isHeadingElement(lastChild)) {
      cur.contentEl.removeChild(lastChild);
      queue.unshift(item);
      queue.unshift(lastChild);
      cur = createA4Page();
      continue;
    }

    // 2. Smart Splitting (Code blocks, Tables, Lists):
    if (smartPageBreaks) {
      // A. Code Blocks (<pre>): split cleanly between lines (\n) using mathematical calculation
      if (item.tagName.toLowerCase() === 'pre') {
        const codeEl = item.querySelector('code') || item;
        const rawCode = codeEl.textContent || '';
        const lines = rawCode.split('\n');

        if (lines.length > 3 && remainingPx >= 65) {
          const computed = sandboxDoc.defaultView?.getComputedStyle(item) || window.getComputedStyle(item);
          const rawLineHeight = parseFloat(computed.lineHeight);
          const fontSize = parseFloat(computed.fontSize) || 13;
          const lineHeight = !isNaN(rawLineHeight) && rawLineHeight > 0 ? rawLineHeight : fontSize * 1.5;
          const padTop = parseFloat(computed.paddingTop) || 14;
          const padBottom = parseFloat(computed.paddingBottom) || 14;

          const availForLines = remainingPx - padTop - padBottom;
          const bestLines = Math.floor(availForLines / lineHeight);

          if (bestLines >= 2 && lines.length - bestLines >= 1) {
            const part1 = item.cloneNode(true) as HTMLElement;
            const code1 = part1.querySelector('code') || part1;
            code1.textContent = lines.slice(0, bestLines).join('\n');
            cur.contentEl.appendChild(part1);

            const part2 = item.cloneNode(true) as HTMLElement;
            const code2 = part2.querySelector('code') || part2;
            code2.textContent = lines.slice(bestLines).join('\n');

            queue.unshift(part2);
            cur = createA4Page();
            continue;
          }
        }
      }

      // B. Tables (<table>): split cleanly between <tr> rows with cloned <thead>
      if (item.tagName.toLowerCase() === 'table') {
        const tbody = item.querySelector('tbody') || item;
        const rows = Array.from(tbody.querySelectorAll<HTMLElement>('tr'));
        const thead = item.querySelector<HTMLElement>('thead');
        const theadHeight = thead ? thead.offsetHeight : 38;

        if (rows.length > 2 && remainingPx >= 70) {
          const rowHeight = rows[0]?.offsetHeight || 36;
          const availForRows = remainingPx - theadHeight - 16;
          const bestRows = Math.floor(availForRows / rowHeight);

          if (bestRows >= 1 && rows.length - bestRows >= 1) {
            const table1 = item.cloneNode(true) as HTMLElement;
            const tbody1 = (table1.querySelector('tbody') || table1) as HTMLElement;
            tbody1.innerHTML = '';
            for (let r = 0; r < bestRows; r++) {
              tbody1.appendChild(rows[r].cloneNode(true));
            }
            cur.contentEl.appendChild(table1);

            const table2 = item.cloneNode(true) as HTMLElement;
            const tbody2 = (table2.querySelector('tbody') || table2) as HTMLElement;
            tbody2.innerHTML = '';
            for (let r = bestRows; r < rows.length; r++) {
              tbody2.appendChild(rows[r].cloneNode(true));
            }

            queue.unshift(table2);
            cur = createA4Page();
            continue;
          }
        }
      }

      // C. Lists (<ul>, <ol>): split cleanly between <li> items
      if (item.tagName.toLowerCase() === 'ul' || item.tagName.toLowerCase() === 'ol') {
        const lis = Array.from(item.querySelectorAll<HTMLElement>('li'));
        if (lis.length > 2 && remainingPx >= 50) {
          const liHeight = lis[0]?.offsetHeight || 26;
          const bestLis = Math.floor((remainingPx - 10) / liHeight);

          if (bestLis >= 1 && lis.length - bestLis >= 1) {
            const list1 = item.cloneNode(false) as HTMLElement;
            for (let l = 0; l < bestLis; l++) {
              list1.appendChild(lis[l].cloneNode(true));
            }
            cur.contentEl.appendChild(list1);

            const list2 = item.cloneNode(false) as HTMLElement;
            if (item.tagName.toLowerCase() === 'ol') {
              list2.setAttribute('start', String(bestLis + 1));
            }
            for (let l = bestLis; l < lis.length; l++) {
              list2.appendChild(lis[l].cloneNode(true));
            }

            queue.unshift(list2);
            cur = createA4Page();
            continue;
          }
        }
      }
    }

    // Default fallback: move full item to new page
    queue.unshift(item);
    cur = createA4Page();
  }

  // Remove empty trailing page if any
  if (cur.contentEl.children.length === 0 && pages.length > 1) {
    pagesContainer.removeChild(cur.pageEl);
    pages.pop();
  }

  return pages;
}

/**
 * Renders each discrete A4 page element to the PDF document using high-res lossless rendering.
 */
async function renderPagesToPdf(
  pdf: jsPDF,
  pages: HTMLElement[],
  themeBgColor: string
): Promise<void> {
  for (let i = 0; i < pages.length; i++) {
    // Yield to the browser main thread between pages so UI stays responsive
    await new Promise((resolve) => setTimeout(resolve, 25));

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    const page = pages[i];
    const canvas = await withTimeout(
      html2canvas(page, {
        scale: 2.0, // Razor sharp Retina 192 DPI
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: themeBgColor || '#ffffff',
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
      }),
      PDF_EXPORT_TIMEOUT_MS
    );

    assertCanvasWithinLimits(canvas);

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

    // Free canvas memory immediately
    canvas.width = 0;
    canvas.height = 0;
  }
}

function mapRenderError(error: unknown): never {
  if (error instanceof PdfExportError) {
    throw error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/out of memory|allocation failed|canvas.*too large/i.test(message)) {
    throw new PdfExportError(
      'MEMORY_LIMIT',
      'Browser ran out of memory while building the PDF. Use a shorter document.'
    );
  }
  throw new PdfExportError('RENDER_FAILED', 'PDF rendering failed. Check images and formatting.');
}

export type PdfPageSize = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';

export interface PageSizeDefinition {
  id: PdfPageSize;
  label: string;
  widthMm: number;
  heightMm: number;
  desc: string;
}

export const PDF_PAGE_SIZES: Record<PdfPageSize, PageSizeDefinition> = {
  A4: { id: 'A4', label: 'A4', widthMm: 210, heightMm: 297, desc: '210 × 297 mm' },
  A3: { id: 'A3', label: 'A3', widthMm: 297, heightMm: 420, desc: '297 × 420 mm' },
  A5: { id: 'A5', label: 'A5', widthMm: 148, heightMm: 210, desc: '148 × 210 mm' },
  Letter: { id: 'Letter', label: 'Letter', widthMm: 216, heightMm: 279, desc: '8.5 × 11 in' },
  Legal: { id: 'Legal', label: 'Legal', widthMm: 216, heightMm: 356, desc: '8.5 × 14 in' },
};

export const DEFAULT_PDF_PAGE_SIZE: PdfPageSize = 'A4';

export const GOOGLE_FONTS_LINK = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
`;

export interface PDFOptions {
  filename?: string;
  documentTitle?: string;
  themeId?: string;
  margins?: PdfMargins;
  smartPageBreaks?: boolean;
  pageSize?: PdfPageSize;
}

const defaultOptions: PDFOptions = {
  filename: 'document.pdf',
  themeId: 'professional',
  margins: DEFAULT_PDF_MARGINS,
  smartPageBreaks: true,
  pageSize: DEFAULT_PDF_PAGE_SIZE,
};

/**
 * Attempts to generate and directly download a 100% vector PDF via the server's Headless Chromium (Puppeteer) engine.
 * Returns true if successful, or false to trigger the client-side fallback.
 */
async function downloadViaPuppeteerBackend(
  fullHtml: string,
  filename: string,
  documentTitle: string,
  margins: PdfMargins,
  smartPageBreaks: boolean,
  pageSize: PdfPageSize = DEFAULT_PDF_PAGE_SIZE
): Promise<boolean> {
  try {
    const cleanTitle = (documentTitle && documentTitle.trim()) || filename.replace(/\.pdf$/i, '');
    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    const response = await fetch('/api/pdf/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: fullHtml,
        title: cleanTitle,
        margins,
        smartPageBreaks,
        pageSize,
      }),
    });

    if (!response.ok) {
      console.warn('[Puppeteer Backend] Server returned non-200, falling back to client generator');
      return false;
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      return false;
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = cleanFilename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch (error) {
    console.warn('[Puppeteer Backend] Request failed, falling back to client generator:', error);
    return false;
  }
}

/**
 * Generate PDF from markdown content
 */
export const generatePDFFromMarkdown = async (
  markdown: string,
  options: PDFOptions = {}
): Promise<void> => {
  const opts = { ...defaultOptions, ...options };
  const margins = opts.margins || DEFAULT_PDF_MARGINS;
  const pageSize = opts.pageSize || DEFAULT_PDF_PAGE_SIZE;
  const docTitle =
    (opts.documentTitle && opts.documentTitle.trim()) ||
    (opts.filename ? opts.filename.replace(/\.pdf$/i, '') : 'Document');
  const safeTitleTag = docTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (markdown.length > PDF_MAX_MARKDOWN_CHARS) {
    throw new PdfExportError(
      'DOCUMENT_TOO_LARGE',
      `Document exceeds ${(PDF_MAX_MARKDOWN_CHARS / 1000).toFixed(0)}k characters. Shorten content before exporting.`
    );
  }

  const theme = getTheme(opts.themeId || 'professional');
  const htmlContent = parseMarkdown(markdown);
  const themedHtml = applyThemeToHTML(htmlContent, theme);

  const sandboxFrame = document.createElement('iframe');
  sandboxFrame.style.position = 'fixed';
  sandboxFrame.style.left = '-9999px';
  sandboxFrame.style.top = '0';
  sandboxFrame.style.width = `${A4_WIDTH_PX}px`;
  sandboxFrame.style.height = `${A4_HEIGHT_PX}px`;
  sandboxFrame.style.border = 'none';
  document.body.appendChild(sandboxFrame);

  try {
    const sandboxDoc = sandboxFrame.contentDocument;
    if (!sandboxDoc) {
      throw new PdfExportError('RENDER_FAILED', 'Could not access PDF render frame.');
    }

    sandboxDoc.open();
    sandboxDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${safeTitleTag}</title>
        ${GOOGLE_FONTS_LINK}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/themes/prism-tomorrow.min.css">
        <style>
          * { box-sizing: border-box; }
          @page {
            size: ${pageSize} portrait;
            margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: ${theme.fonts.body};
            color: ${theme.colors.text};
            background-color: ${theme.colors.background};
            font-size: ${theme.fontSize.base};
            line-height: ${theme.spacing.lineHeight};
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          h1 {
            font-family: ${theme.fonts.headings};
            font-size: ${theme.fontSize.h1};
            color: ${theme.colors.headings};
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            font-weight: 700;
            line-height: 1.2;
          }
          h2 {
            font-family: ${theme.fonts.headings};
            font-size: ${theme.fontSize.h2};
            color: ${theme.colors.headings};
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            font-weight: 700;
            line-height: 1.25;
          }
          h3 {
            font-family: ${theme.fonts.headings};
            font-size: ${theme.fontSize.h3};
            color: ${theme.colors.headings};
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            font-weight: 600;
            line-height: 1.3;
          }
          h4, h5, h6 {
            font-family: ${theme.fonts.headings};
            font-size: ${theme.fontSize.h4};
            color: ${theme.colors.headings};
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            font-weight: 600;
            line-height: 1.35;
          }
          p {
            margin: ${theme.spacing.paragraphMargin} 0;
            line-height: ${theme.spacing.lineHeight};
            color: ${theme.colors.text};
          }
          a {
            color: ${theme.colors.links};
            text-decoration: underline;
          }
          code {
            font-family: ${theme.fonts.code};
            font-size: ${theme.fontSize.code};
            background-color: ${theme.colors.codeBackground};
            color: ${theme.colors.codeText};
            padding: 2px 6px;
            border-radius: 4px;
          }
          pre {
            background-color: ${theme.colors.codeBackground};
            color: ${theme.colors.codeText};
            padding: 14px 16px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 14px 0 16px;
            font-family: ${theme.fonts.code};
            font-size: ${theme.fontSize.code};
            border: 1px solid ${theme.colors.tableBorder};
          }
          pre code {
            background: none !important;
            padding: 0 !important;
            color: inherit !important;
            border-radius: 0 !important;
          }
          blockquote {
            border-left: 4px solid ${theme.colors.quoteBorder};
            padding: 8px 16px;
            margin: 14px 0;
            color: ${theme.colors.quoteText};
            background-color: ${theme.id === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'};
            border-radius: 0 6px 6px 0;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 14px 0 18px;
            border: 1px solid ${theme.colors.tableBorder};
          }
          th, td {
            border: 1px solid ${theme.colors.tableBorder};
            padding: 8px 12px;
            text-align: left;
            color: ${theme.colors.text};
          }
          th {
            background-color: ${theme.colors.tableHeaderBg};
            color: ${theme.colors.headings};
            font-weight: 700;
          }
          hr {
            border: none;
            border-top: 1px solid ${theme.colors.tableBorder};
            margin: 20px 0;
          }
          ul, ol {
            padding-left: 28px;
            margin: 10px 0;
            color: ${theme.colors.text};
          }
          li {
            margin: 4px 0;
          }
          .mermaid { display: flex; justify-content: center; margin: 1.2rem 0; max-width: 100%; }
          .mermaid svg { max-width: 100%; height: auto; }
          ${MERMAID_DIAGRAM_STYLES}
          ${(opts.smartPageBreaks ?? true) ? `
          h1, h2, h3, h4, h5, h6 { page-break-after: avoid; break-after: avoid; }
          pre, blockquote, table, tr, .mermaid { page-break-inside: avoid; break-inside: avoid; }
          ` : ''}
        </style>
      </head>
      <body>
        <div id="pdf-content">
          ${themedHtml}
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/prism.min.js"></script>
      </body>
      </html>
    `);
    sandboxDoc.close();

    await renderMermaidInDocument(sandboxDoc, theme.id === 'dark');
    await waitForMermaidPaint(600);

    const prism = (sandboxDoc.defaultView as any)?.Prism || Prism;
    if (prism) {
      prism.highlightAllUnder(sandboxDoc.body);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    await processSandboxImages(sandboxDoc);

    // 1. High-fidelity Vector PDF via Puppeteer Backend
    const fullHtml = sandboxDoc.documentElement.outerHTML;
    const downloadedViaPuppeteer = await downloadViaPuppeteerBackend(
      fullHtml,
      opts.filename || 'document.pdf',
      docTitle,
      margins,
      opts.smartPageBreaks ?? true,
      pageSize
    );
    if (downloadedViaPuppeteer) {
      return;
    }

    // 2. Client-side fallback if backend is offline/unreachable
    const contentEl = sandboxDoc.getElementById('pdf-content');
    if (!contentEl) {
      throw new PdfExportError('RENDER_FAILED', 'Content element not found.');
    }

    const pages = layoutContentIntoA4Pages(
      sandboxDoc,
      contentEl,
      theme,
      margins,
      opts.smartPageBreaks ?? true
    );

    contentEl.style.display = 'none';

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: pageSize.toLowerCase() as any,
      compress: true,
    });
    pdf.setProperties({
      title: docTitle,
      author: 'MD2PDFX',
    });

    await renderPagesToPdf(pdf, pages, theme.colors.background);
    pdf.save(opts.filename || 'document.pdf');
  } catch (error) {
    mapRenderError(error);
  } finally {
    if (document.body.contains(sandboxFrame)) {
      document.body.removeChild(sandboxFrame);
    }
  }
};

/**
 * Generate PDF from HTML element (the actual preview pane).
 * Directly downloads the PDF file with pixel-perfect A4 pagination and margins.
 */
export const generatePDFFromElement = async (
  element: HTMLElement,
  options: PDFOptions = {}
): Promise<void> => {
  const opts = { ...defaultOptions, ...options };
  const theme = getTheme(opts.themeId || 'professional');
  const margins = opts.margins || DEFAULT_PDF_MARGINS;
  const pageSize = opts.pageSize || DEFAULT_PDF_PAGE_SIZE;
  const docTitle =
    (opts.documentTitle && opts.documentTitle.trim()) ||
    (opts.filename ? opts.filename.replace(/\.pdf$/i, '') : 'Document');
  const safeTitleTag = docTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let sourceElement: HTMLElement = element;
  let iframeStyles: string = '';

  const iframe = element.querySelector('iframe');
  if (iframe && iframe.contentDocument) {
    const previewContent = iframe.contentDocument.getElementById('preview-content');
    sourceElement = previewContent || iframe.contentDocument.body;

    const styleElements = iframe.contentDocument.head.querySelectorAll('style, link[rel="stylesheet"]');
    const stylePromises = Array.from(styleElements).map(async (style) => {
      if (style.tagName.toLowerCase() === 'style') {
        return style.innerHTML;
      } else if (style.tagName.toLowerCase() === 'link' && (style as HTMLLinkElement).rel === 'stylesheet') {
        try {
          const res = await fetch((style as HTMLLinkElement).href);
          return await res.text();
        } catch {
          return '';
        }
      }
      return '';
    });
    const loadedStyles = await Promise.all(stylePromises);
    iframeStyles = loadedStyles.join('\n');
  }

  const sandboxFrame = document.createElement('iframe');
  sandboxFrame.style.position = 'fixed';
  sandboxFrame.style.left = '-9999px';
  sandboxFrame.style.top = '0';
  sandboxFrame.style.width = `${A4_WIDTH_PX}px`;
  sandboxFrame.style.height = `${A4_HEIGHT_PX}px`;
  sandboxFrame.style.border = 'none';
  document.body.appendChild(sandboxFrame);

  try {
    const sandboxDoc = sandboxFrame.contentDocument;
    if (!sandboxDoc) {
      throw new PdfExportError('RENDER_FAILED', 'Could not access PDF render frame.');
    }

    sandboxDoc.open();
    sandboxDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${safeTitleTag}</title>
        ${GOOGLE_FONTS_LINK}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/themes/prism-tomorrow.min.css">
        <style>
          * { box-sizing: border-box; }
          @page {
            size: ${pageSize} portrait;
            margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: ${theme.fonts.body};
            color: ${theme.colors.text};
            background-color: ${theme.colors.background};
            font-size: ${theme.fontSize.base};
            line-height: ${theme.spacing.lineHeight};
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          h1 {
            font-family: ${theme.fonts.headings};
            font-size: ${theme.fontSize.h1};
            color: ${theme.colors.headings};
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            font-weight: 700;
            line-height: 1.2;
          }
          h2 {
            font-family: ${theme.fonts.headings};
            font-size: ${theme.fontSize.h2};
            color: ${theme.colors.headings};
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            font-weight: 700;
            line-height: 1.25;
          }
          h3 {
            font-family: ${theme.fonts.headings};
            font-size: ${theme.fontSize.h3};
            color: ${theme.colors.headings};
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            font-weight: 600;
            line-height: 1.3;
          }
          h4, h5, h6 {
            font-family: ${theme.fonts.headings};
            font-size: ${theme.fontSize.h4};
            color: ${theme.colors.headings};
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            font-weight: 600;
            line-height: 1.35;
          }
          p {
            margin: ${theme.spacing.paragraphMargin} 0;
            line-height: ${theme.spacing.lineHeight};
            color: ${theme.colors.text};
          }
          a {
            color: ${theme.colors.links};
            text-decoration: underline;
          }
          code {
            font-family: ${theme.fonts.code};
            font-size: ${theme.fontSize.code};
            background-color: ${theme.colors.codeBackground};
            color: ${theme.colors.codeText};
            padding: 2px 6px;
            border-radius: 4px;
          }
          pre {
            background-color: ${theme.colors.codeBackground};
            color: ${theme.colors.codeText};
            padding: 14px 16px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 14px 0 16px;
            font-family: ${theme.fonts.code};
            font-size: ${theme.fontSize.code};
            border: 1px solid ${theme.colors.tableBorder};
          }
          pre code {
            background: none !important;
            padding: 0 !important;
            color: inherit !important;
            border-radius: 0 !important;
          }
          blockquote {
            border-left: 4px solid ${theme.colors.quoteBorder};
            padding: 8px 16px;
            margin: 14px 0;
            color: ${theme.colors.quoteText};
            background-color: ${theme.id === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'};
            border-radius: 0 6px 6px 0;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 14px 0 18px;
            border: 1px solid ${theme.colors.tableBorder};
          }
          th, td {
            border: 1px solid ${theme.colors.tableBorder};
            padding: 8px 12px;
            text-align: left;
            color: ${theme.colors.text};
          }
          th {
            background-color: ${theme.colors.tableHeaderBg};
            color: ${theme.colors.headings};
            font-weight: 700;
          }
          hr {
            border: none;
            border-top: 1px solid ${theme.colors.tableBorder};
            margin: 20px 0;
          }
          ul, ol {
            padding-left: 28px;
            margin: 10px 0;
            color: ${theme.colors.text};
          }
          li {
            margin: 4px 0;
          }
          .mermaid { display: flex; justify-content: center; margin: 1.2rem 0; max-width: 100%; }
          .mermaid svg { max-width: 100%; height: auto; }
          ${MERMAID_DIAGRAM_STYLES}
          ${iframeStyles}
          ${(opts.smartPageBreaks ?? true) ? `
          h1, h2, h3, h4, h5, h6 { page-break-after: avoid; break-after: avoid; }
          pre, blockquote, table, tr, .mermaid { page-break-inside: avoid; break-inside: avoid; }
          ` : ''}
        </style>
      </head>
      <body>
        <div id="pdf-content">
          ${sourceElement.innerHTML}
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/prism.min.js"></script>
      </body>
      </html>
    `);
    sandboxDoc.close();

    await renderMermaidInDocument(sandboxDoc, theme.id === 'dark');
    await waitForMermaidPaint(600);

    const prism = (sandboxDoc.defaultView as any)?.Prism || Prism;
    if (prism) {
      prism.highlightAllUnder(sandboxDoc.body);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    await processSandboxImages(sandboxDoc);

    // 1. High-fidelity Vector PDF via Puppeteer Backend
    const fullHtml = sandboxDoc.documentElement.outerHTML;
    const downloadedViaPuppeteer = await downloadViaPuppeteerBackend(
      fullHtml,
      opts.filename || 'document.pdf',
      docTitle,
      margins,
      opts.smartPageBreaks ?? true,
      pageSize
    );
    if (downloadedViaPuppeteer) {
      return;
    }

    // 2. Client-side fallback if backend is offline/unreachable
    const contentEl = sandboxDoc.getElementById('pdf-content');
    if (!contentEl) {
      throw new PdfExportError('RENDER_FAILED', 'Content element not found.');
    }

    const pages = layoutContentIntoA4Pages(
      sandboxDoc,
      contentEl,
      theme,
      margins,
      opts.smartPageBreaks ?? true
    );

    contentEl.style.display = 'none';

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: pageSize.toLowerCase() as any,
      compress: true,
    });
    pdf.setProperties({
      title: docTitle,
      author: 'MD2PDFX',
    });

    await renderPagesToPdf(pdf, pages, theme.colors.background);
    pdf.save(opts.filename || 'document.pdf');
  } catch (error) {
    mapRenderError(error);
  } finally {
    if (document.body.contains(sandboxFrame)) {
      document.body.removeChild(sandboxFrame);
    }
  }
};

export interface PrintOptions {
  element?: HTMLElement | null;
  markdown?: string;
  themeId?: string;
  title?: string;
  margins?: PdfMargins;
  pageSize?: PdfPageSize;
}

/**
 * Triggers native browser print dialog (Save as PDF).
 * Produces 100% vector PDFs with selectable text, clickable links, perfect CSS breaks,
 * and zero memory limits — capable of exporting documents of unlimited length (100+ pages).
 */
export const exportViaBrowserPrint = async (options: PrintOptions): Promise<void> => {
  const theme = getTheme(options.themeId || 'professional');
  const title = options.title || 'document';
  const margins = options.margins || DEFAULT_PDF_MARGINS;
  const pageSize = options.pageSize || DEFAULT_PDF_PAGE_SIZE;

  let printHtml = '';
  let customStyles = '';

  const iframe = options.element?.querySelector('iframe');
  if (iframe && iframe.contentDocument) {
    const previewContent = iframe.contentDocument.getElementById('preview-content');
    if (previewContent) {
      printHtml = previewContent.innerHTML;
    } else {
      printHtml = iframe.contentDocument.body.innerHTML;
    }

    const styleElements = iframe.contentDocument.head.querySelectorAll('style, link[rel="stylesheet"]');
    const stylePromises = Array.from(styleElements).map(async (style) => {
      if (style.tagName.toLowerCase() === 'style') return style.innerHTML;
      if (style.tagName.toLowerCase() === 'link' && (style as HTMLLinkElement).rel === 'stylesheet') {
        try {
          const res = await fetch((style as HTMLLinkElement).href);
          return await res.text();
        } catch {
          return '';
        }
      }
      return '';
    });
    const loadedStyles = await Promise.all(stylePromises);
    customStyles = loadedStyles.join('\n');
  } else if (options.markdown) {
    printHtml = applyThemeToHTML(parseMarkdown(options.markdown), theme);
  }

  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  printFrame.style.visibility = 'hidden';
  document.body.appendChild(printFrame);

  try {
    const printDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!printDoc) {
      throw new Error('Could not access print frame.');
    }

    printDoc.open();
    printDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
        ${GOOGLE_FONTS_LINK}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/themes/prism-tomorrow.min.css">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
            font-family: ${theme.fonts.body};
            color: ${theme.colors.text};
            background-color: ${theme.colors.background};
            font-size: ${theme.fontSize.base};
            line-height: ${theme.spacing.lineHeight};
          }
          @page {
            size: ${pageSize} portrait;
            margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
          }
          @media print {
            body {
              background-color: ${theme.colors.background} !important;
              color: ${theme.colors.text} !important;
              padding: 0 !important;
              margin: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            pre, code, table, tr, img, blockquote, .mermaid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            h1, h2, h3, h4, h5, h6 {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
          }
          /* Headings */
          h1, h2, h3, h4, h5, h6 {
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            line-height: 1.25;
            color: ${theme.colors.headings};
          }
          table { border-collapse: collapse; width: 100%; margin: 12px 0 16px; border: 1px solid ${theme.colors.tableBorder}; }
          th, td { border: 1px solid ${theme.colors.tableBorder}; padding: 8px 12px; }
          th { background-color: ${theme.colors.tableHeaderBg}; font-weight: bold; color: ${theme.colors.headings}; }
          pre { margin: 12px 0 16px; padding: 14px; background-color: ${theme.colors.codeBackground}; color: ${theme.colors.codeText}; border-radius: 6px; overflow-x: auto; border: 1px solid ${theme.colors.tableBorder}; }
          code { font-family: ${theme.fonts.code}; }
          .mermaid { display: flex; justify-content: center; margin: 1.2rem 0; max-width: 100%; }
          .mermaid svg { max-width: 100%; height: auto; }
          ${MERMAID_DIAGRAM_STYLES}
          ${customStyles}
        </style>
      </head>
      <body>
        <div id="print-root">
          ${printHtml}
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/prism.min.js"></script>
      </body>
      </html>
    `);
    printDoc.close();

    await renderMermaidInDocument(printDoc, theme.id === 'dark');
    await waitForMermaidPaint(400);

    await new Promise((resolve) => setTimeout(resolve, 300));

    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();
  } finally {
    setTimeout(() => {
      if (document.body.contains(printFrame)) {
        document.body.removeChild(printFrame);
      }
    }, 5000);
  }
};
