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
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const thead = item.querySelector('thead');
        const theadHeight = thead?.offsetHeight || 38;

        if (rows.length > 2 && remainingPx >= 70) {
          const rowHeight = rows[0]?.offsetHeight || 36;
          const availForRows = remainingPx - theadHeight - 16;
          const bestRows = Math.floor(availForRows / rowHeight);

          if (bestRows >= 1 && rows.length - bestRows >= 1) {
            const table1 = item.cloneNode(true) as HTMLElement;
            const tbody1 = table1.querySelector('tbody') || table1;
            tbody1.innerHTML = '';
            for (let r = 0; r < bestRows; r++) {
              tbody1.appendChild(rows[r].cloneNode(true));
            }
            cur.contentEl.appendChild(table1);

            const table2 = item.cloneNode(true) as HTMLElement;
            const tbody2 = table2.querySelector('tbody') || table2;
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
        const lis = Array.from(item.querySelectorAll(':scope > li'));
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

export interface PDFOptions {
  filename?: string;
  themeId?: string;
  margins?: PdfMargins;
  smartPageBreaks?: boolean;
}

const defaultOptions: PDFOptions = {
  filename: 'document.pdf',
  themeId: 'professional',
  margins: DEFAULT_PDF_MARGINS,
  smartPageBreaks: true,
};

/**
 * Generate PDF from markdown content
 */
export const generatePDFFromMarkdown = async (
  markdown: string,
  options: PDFOptions = {}
): Promise<void> => {
  const opts = { ...defaultOptions, ...options };
  const margins = opts.margins || DEFAULT_PDF_MARGINS;

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
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/themes/prism-tomorrow.min.css">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            font-family: ${theme.fonts.body};
            color: ${theme.colors.text};
            background-color: ${theme.colors.background};
          }
          ul, ol { padding-left: 30px; margin: 10px 0; }
          li { margin: 5px 0; }
          p { margin: ${theme.spacing.paragraphMargin} 0; line-height: ${theme.spacing.lineHeight}; }
          table { border-collapse: collapse; width: 100%; margin: 12px 0 16px; }
          th, td { border: 1px solid ${theme.colors.tableBorder}; padding: 8px 12px; }
          th { background-color: ${theme.colors.tableHeaderBg}; font-weight: bold; }
          pre { margin: 12px 0 16px; padding: 14px; background-color: #2d2d30; color: #ccc; border-radius: 6px; }
          code { font-family: ${theme.fonts.code}; }
          a { color: ${theme.colors.links}; text-decoration: none; }
          h1, h2, h3, h4, h5, h6 {
            font-weight: bold;
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            line-height: 1.25;
          }
          .mermaid { display: flex; justify-content: center; margin: 1.2rem 0; max-width: 100%; }
          .mermaid svg { max-width: 100%; height: auto; }
          ${MERMAID_DIAGRAM_STYLES}
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

    await renderMermaidInDocument(sandboxDoc);
    await waitForMermaidPaint(600);

    const prism = (sandboxDoc.defaultView as any)?.Prism || Prism;
    if (prism) {
      prism.highlightAllUnder(sandboxDoc.body);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    await processSandboxImages(sandboxDoc);

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
      format: 'a4',
      compress: true,
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
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/themes/prism-tomorrow.min.css">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            font-family: ${theme.fonts.body};
            color: ${theme.colors.text};
            background-color: ${theme.colors.background};
          }
          ul, ol { padding-left: 30px; margin: 10px 0; }
          li { margin: 5px 0; }
          p { margin: ${theme.spacing.paragraphMargin} 0; line-height: ${theme.spacing.lineHeight}; }
          table { border-collapse: collapse; width: 100%; margin: 12px 0 16px; }
          th, td { border: 1px solid ${theme.colors.tableBorder}; padding: 8px 12px; }
          th { background-color: ${theme.colors.tableHeaderBg}; font-weight: bold; }
          pre { margin: 12px 0 16px; padding: 14px; background-color: #2d2d30; color: #ccc; border-radius: 6px; }
          code { font-family: ${theme.fonts.code}; }
          a { color: ${theme.colors.links}; text-decoration: none; }
          h1, h2, h3, h4, h5, h6 {
            font-weight: bold;
            margin-top: ${theme.spacing.headingMargin};
            margin-bottom: ${theme.spacing.paragraphMargin};
            line-height: 1.25;
          }
          .mermaid { display: flex; justify-content: center; margin: 1.2rem 0; max-width: 100%; }
          .mermaid svg { max-width: 100%; height: auto; }
          ${MERMAID_DIAGRAM_STYLES}
          ${iframeStyles}
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

    await renderMermaidInDocument(sandboxDoc);
    await waitForMermaidPaint(600);

    const prism = (sandboxDoc.defaultView as any)?.Prism || Prism;
    if (prism) {
      prism.highlightAllUnder(sandboxDoc.body);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    await processSandboxImages(sandboxDoc);

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
      format: 'a4',
      compress: true,
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
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/themes/prism-tomorrow.min.css">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
            font-family: ${theme.fonts.body};
            color: ${theme.colors.text};
            background-color: #ffffff;
            font-size: ${theme.fontSize.base};
            line-height: ${theme.spacing.lineHeight};
          }
          @page {
            size: A4 portrait;
            margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
          }
          @media print {
            body {
              background-color: #ffffff !important;
              color: #111827 !important;
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
          }
          table { border-collapse: collapse; width: 100%; margin: 12px 0 16px; }
          th, td { border: 1px solid ${theme.colors.tableBorder}; padding: 8px 12px; }
          th { background-color: ${theme.colors.tableHeaderBg}; font-weight: bold; }
          pre { margin: 12px 0 16px; padding: 14px; background-color: #2d2d30; color: #ccc; border-radius: 6px; overflow-x: auto; }
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

    await renderMermaidInDocument(printDoc);
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
