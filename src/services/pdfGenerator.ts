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

/**
 * Calculates adaptive rendering scale based on container height in pixels.
 * Shorter documents get ultra-crisp Retina quality (scale 2), while longer
 * documents scale down to fit safely within browser canvas dimensions and RAM.
 */
function getAdaptiveScale(elementHeightPx: number): number {
  if (elementHeightPx <= 7000) {
    return 2.0; // 1-5 pages: Retina ultra-crisp
  }
  if (elementHeightPx <= 16000) {
    return 1.5; // 6-14 pages: High DPI crisp
  }
  if (elementHeightPx <= 30000) {
    return 1.25; // 15-26 pages: High performance
  }
  return 1.0; // 27+ pages: 1:1 scale to avoid exceeding browser limits
}

/**
 * Slices a master canvas into discrete A4 page canvases and appends them to jsPDF.
 * This ensures each page only stores its own single slice (typically 150KB - 300KB)
 * instead of the entire document's multi-megabyte image duplicated on every page.
 */
function addCanvasToPdfInPageSlices(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  themeBgColor: string,
  imgWidthMm: number = 210,
  pageHeightMm: number = 297,
  isFirstChunk: boolean = true
): void {
  const a4Ratio = pageHeightMm / imgWidthMm;
  const pageHeightPx = Math.floor(canvas.width * a4Ratio);

  let currentY = 0;
  let pageCount = 0;

  const sliceCanvas = document.createElement('canvas');
  sliceCanvas.width = canvas.width;
  const sliceCtx = sliceCanvas.getContext('2d');

  while (currentY < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - currentY);
    sliceCanvas.height = sliceHeight;

    if (sliceCtx) {
      sliceCtx.fillStyle = themeBgColor || '#ffffff';
      sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sliceCtx.drawImage(
        canvas,
        0, currentY, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight
      );

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const sliceHeightMm = (sliceHeight * imgWidthMm) / canvas.width;

      if (!isFirstChunk || pageCount > 0) {
        pdf.addPage();
      }

      pdf.addImage(sliceData, 'JPEG', 0, 0, imgWidthMm, sliceHeightMm);
    }

    currentY += sliceHeight;
    pageCount++;
  }

  // Cleanup offscreen slice canvas
  sliceCanvas.width = 0;
  sliceCanvas.height = 0;
}

/**
 * Renders an element to jsPDF in either a single pass or sequential chunks
 * if the content is exceptionally tall, preventing browser canvas dimension overflow.
 */
async function renderElementToPdf(
  pdf: jsPDF,
  wrapperElement: HTMLElement,
  containerContentEl: HTMLElement,
  themeBgColor: string,
  scale: number
): Promise<void> {
  const CHUNK_HEIGHT_LIMIT = 18000;
  const totalHeight = wrapperElement.scrollHeight;
  const children = Array.from(containerContentEl.children) as HTMLElement[];

  if (totalHeight <= CHUNK_HEIGHT_LIMIT || children.length <= 1) {
    const canvas = await withTimeout(
      html2canvas(wrapperElement, {
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 794,
        width: 794,
        backgroundColor: themeBgColor,
      }),
      PDF_EXPORT_TIMEOUT_MS
    );

    assertCanvasWithinLimits(canvas);
    addCanvasToPdfInPageSlices(pdf, canvas, themeBgColor);
    canvas.width = 0;
    canvas.height = 0;
    return;
  }

  // Multi-chunk rendering for large documents: group children into chunks
  const chunks: HTMLElement[][] = [];
  let currentGroup: HTMLElement[] = [];
  let accumulatedHeight = 0;

  for (const child of children) {
    const h = Math.max(child.offsetHeight, 40);
    if (accumulatedHeight + h > CHUNK_HEIGHT_LIMIT && currentGroup.length > 0) {
      chunks.push(currentGroup);
      currentGroup = [child];
      accumulatedHeight = h;
    } else {
      currentGroup.push(child);
      accumulatedHeight += h;
    }
  }
  if (currentGroup.length > 0) {
    chunks.push(currentGroup);
  }

  for (let i = 0; i < chunks.length; i++) {
    const activeChunk = chunks[i];

    // Hide children that are not in this chunk
    children.forEach((c) => {
      c.style.display = activeChunk.includes(c) ? '' : 'none';
    });

    await new Promise((r) => setTimeout(r, 80));

    const chunkCanvas = await withTimeout(
      html2canvas(wrapperElement, {
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 794,
        width: 794,
        backgroundColor: themeBgColor,
      }),
      PDF_EXPORT_TIMEOUT_MS
    );

    assertCanvasWithinLimits(chunkCanvas);
    addCanvasToPdfInPageSlices(pdf, chunkCanvas, themeBgColor, 210, 297, i === 0);

    chunkCanvas.width = 0;
    chunkCanvas.height = 0;
  }

  // Restore visibility
  children.forEach((c) => {
    c.style.display = '';
  });
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
}

const defaultOptions: PDFOptions = {
  filename: 'document.pdf',
  themeId: 'professional',
};

/**
 * Generate PDF from markdown content
 * Uses html2canvas + jsPDF with Prism.js syntax highlighting to match preview
 */
export const generatePDFFromMarkdown = async (
  markdown: string,
  options: PDFOptions = {}
): Promise<void> => {
  const opts = { ...defaultOptions, ...options };

  if (markdown.length > PDF_MAX_MARKDOWN_CHARS) {
    throw new PdfExportError(
      'DOCUMENT_TOO_LARGE',
      `Document exceeds ${(PDF_MAX_MARKDOWN_CHARS / 1000).toFixed(0)}k characters. Shorten content before exporting.`
    );
  }

  const theme = getTheme(opts.themeId || 'professional');
  const htmlContent = parseMarkdown(markdown);
  const themedHtml = applyThemeToHTML(htmlContent, theme);
  
  // Create a temporary container matching preview pane styles
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width in pixels at 96 DPI
  container.style.padding = '40px';
  container.style.backgroundColor = theme.colors.background;
  container.style.color = theme.colors.text;
  container.style.fontFamily = theme.fonts.body;
  container.style.fontSize = theme.fontSize.base;
  container.style.lineHeight = theme.spacing.lineHeight;
  container.style.overflow = 'visible';
  container.className = 'pdf-export-container';
  container.innerHTML = themedHtml;
  
  // Add Prism Tomorrow theme styles to match preview exactly
  const prismStyles = document.createElement('style');
  prismStyles.textContent = `
    /* Prism Tomorrow Theme - matching preview */
    .pdf-export-container pre[class*="language-"] {
      background: #2d2d30;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
      overflow-x: auto;
      color: #ccc;
      text-shadow: none;
      font-family: 'Courier New', Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
      font-size: ${theme.fontSize.code};
      line-height: 1.5;
      direction: ltr;
      text-align: left;
      white-space: pre;
      word-spacing: normal;
      word-break: normal;
      word-wrap: normal;
      tab-size: 4;
      hyphens: none;
    }
    
    .pdf-export-container code[class*="language-"] {
      background: transparent;
      color: #ccc;
      text-shadow: none;
      font-family: 'Courier New', Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
      font-size: ${theme.fontSize.code};
      line-height: 1.5;
    }
    
    .pdf-export-container :not(pre) > code {
      background: ${theme.colors.codeBackground};
      color: ${theme.colors.codeText};
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', Consolas, Monaco, monospace;
      font-size: ${theme.fontSize.code};
    }
    
    /* Prism Token Colors - Tomorrow Theme */
    .pdf-export-container .token.comment,
    .pdf-export-container .token.block-comment,
    .pdf-export-container .token.prolog,
    .pdf-export-container .token.doctype,
    .pdf-export-container .token.cdata {
      color: #999;
    }
    
    .pdf-export-container .token.punctuation {
      color: #ccc;
    }
    
    .pdf-export-container .token.tag,
    .pdf-export-container .token.attr-name,
    .pdf-export-container .token.namespace,
    .pdf-export-container .token.deleted {
      color: #e2777a;
    }
    
    .pdf-export-container .token.function-name {
      color: #6196cc;
    }
    
    .pdf-export-container .token.boolean,
    .pdf-export-container .token.number,
    .pdf-export-container .token.function {
      color: #f08d49;
    }
    
    .pdf-export-container .token.property,
    .pdf-export-container .token.class-name,
    .pdf-export-container .token.constant,
    .pdf-export-container .token.symbol {
      color: #f8c555;
    }
    
    .pdf-export-container .token.selector,
    .pdf-export-container .token.important,
    .pdf-export-container .token.atrule,
    .pdf-export-container .token.keyword,
    .pdf-export-container .token.builtin {
      color: #cc99cd;
    }
    
    .pdf-export-container .token.string,
    .pdf-export-container .token.char,
    .pdf-export-container .token.attr-value,
    .pdf-export-container .token.regex,
    .pdf-export-container .token.variable {
      color: #7ec699;
    }
    
    .pdf-export-container .token.operator,
    .pdf-export-container .token.entity,
    .pdf-export-container .token.url {
      color: #67cdcc;
    }
    
    .pdf-export-container .token.important,
    .pdf-export-container .token.bold {
      font-weight: bold;
    }
    
    .pdf-export-container .token.italic {
      font-style: italic;
    }
    
    .pdf-export-container .token.entity {
      cursor: help;
    }
    
    .pdf-export-container .token.inserted {
      color: green;
    }
  `;
  
  document.head.appendChild(prismStyles);
  document.body.appendChild(container);

  try {
    await renderMermaidInDocument(document);
    await waitForMermaidPaint(500);

    Prism.highlightAllUnder(container);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const totalHeight = container.scrollHeight;
    const scale = getAdaptiveScale(totalHeight);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    await renderElementToPdf(pdf, container, container, theme.colors.background, scale);
    pdf.save(opts.filename || 'document.pdf');
  } catch (error) {
    mapRenderError(error);
  } finally {
    // Clean up
    document.body.removeChild(container);
    document.head.removeChild(prismStyles);
  }
};

/**
 * Generate PDF from HTML element (the actual preview pane)
 * This captures the preview exactly as rendered with all styles
 */
export const generatePDFFromElement = async (
  element: HTMLElement,
  options: PDFOptions = {}
): Promise<void> => {
  const opts = { ...defaultOptions, ...options };
  const theme = getTheme(opts.themeId || 'professional');

  // Handle Iframe source (PreviewPane refactor)
  let sourceElement: HTMLElement = element;
  let iframeStyles: string = '';

  const iframe = element.querySelector('iframe');
  if (iframe && iframe.contentDocument) {
      const iframeBody = iframe.contentDocument.body;
      const previewContent = iframeBody.querySelector('#preview-content') as HTMLElement;
      
      if (previewContent) {
          sourceElement = previewContent;
      } else {
          sourceElement = iframeBody; // Fallback
      }

      // Extract styles from iframe head (including linked stylesheets)
      const styleElements = iframe.contentDocument.head.querySelectorAll('style, link[rel="stylesheet"]');
      
      const stylePromises = Array.from(styleElements).map(async (style) => {
          if (style.tagName.toLowerCase() === 'style') {
              return style.innerHTML;
          } else if (style.tagName.toLowerCase() === 'link' && (style as HTMLLinkElement).rel === 'stylesheet') {
              try {
                  const href = (style as HTMLLinkElement).href;
                  // Skip internal/blob URLs if needed, but try fetching everything
                  const response = await fetch(href);
                  return await response.text();
              } catch {
                  return '';
              }
          }
          return '';
      });

      const loadedStyles = await Promise.all(stylePromises);
      iframeStyles = loadedStyles.join('\n');
  }
  
  // Create a sandbox iframe for PDF generation
  const sandboxFrame = document.createElement('iframe');
  sandboxFrame.style.position = 'fixed';
  sandboxFrame.style.left = '-9999px';
  sandboxFrame.style.top = '0';
  sandboxFrame.style.width = '794px'; // A4 width
  sandboxFrame.style.height = '1123px'; // A4 height
  sandboxFrame.style.border = 'none';
  document.body.appendChild(sandboxFrame);

  try {
      const sandboxDoc = sandboxFrame.contentDocument;
      if (!sandboxDoc) {
        throw new PdfExportError('RENDER_FAILED', 'Could not access PDF render frame.');
      }

      // Write content to sandbox
      sandboxDoc.open();
      sandboxDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                * { box-sizing: border-box; }
                
                body {
                    margin: 0;
                    padding: 0;
                    font-family: ${theme.fonts.body};
                    color: ${theme.colors.text};
                    background-color: ${theme.colors.background};
                }
                
                /* List & Text Styles */
                ul, ol { padding-left: 30px; margin: 10px 0; }
                li { margin: 5px 0; }
                p { margin: ${theme.spacing.paragraphMargin} 0; line-height: ${theme.spacing.lineHeight}; }
                
                /* Tables & Code */
                table { border-collapse: collapse; width: 100%; margin: 12px 0 16px; }
                th, td { border: 1px solid ${theme.colors.tableBorder}; padding: 8px 12px; }
                th { background-color: ${theme.colors.tableHeaderBg}; font-weight: bold; }
                pre { margin: 12px 0 16px; padding: 12px; background-color: ${theme.colors.codeBackground}; border-radius: 6px; }
                code { font-family: ${theme.fonts.code}; }
                
                /* Links */
                a { color: ${theme.colors.links}; text-decoration: none; }

                /* Headings - Default styles (can be overridden) */
                h1, h2, h3, h4, h5, h6 {
                    font-weight: bold;
                    margin-top: ${theme.spacing.headingMargin};
                    margin-bottom: ${theme.spacing.paragraphMargin};
                    padding-bottom: 0;
                    line-height: 1.2;
                }
                
                /* Prevent page breaks (Critical - keep !important) */
                h1, h2, h3, h4, h5, h6, pre, code, table, tr, blockquote, ul, ol {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                
                h1, h2, h3, h4, h5, h6 {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                }

                .mermaid { display: flex; justify-content: center; margin: 1rem 0; max-width: 100%; }
                .mermaid svg { max-width: 100%; height: auto; }
                ${MERMAID_DIAGRAM_STYLES}

                /* User Custom Styles (Injected last to override defaults) */
                ${iframeStyles}
            </style>
        </head>
        <body>
            <div id="print-wrapper" style="padding: 20mm; min-height: 100vh; box-sizing: border-box;">
                <div id="pdf-content">
                    ${sourceElement.innerHTML}
                </div>
            </div>
        </body>
        </html>
      `);
      sandboxDoc.close();

      await renderMermaidInDocument(sandboxDoc);
      await waitForMermaidPaint(600);

      await new Promise((resolve) => setTimeout(resolve, 400));
      
      const wrapper = sandboxDoc.body;

    // Handle images: Convert to Base64 (Proxy Logic)
    const images = wrapper.querySelectorAll('img');
    const imagePromises = Array.from(images).map(async (img) => {
        const originalSrc = img.src;
        
        try {
            // Helper to fetch and convert to base64
            const toBase64 = async (url: string): Promise<string> => {
                const response = await fetch(url);
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            };

            let base64Data = '';
            try {
                base64Data = await toBase64(originalSrc);
            } catch (e) {
                // Try via allorigins proxy
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalSrc)}`;
                base64Data = await toBase64(proxyUrl);
            }

            // Replace image source with Base64 data
            if (base64Data) {
                img.src = base64Data;
                img.removeAttribute('crossorigin'); 
            }
        } catch {
             img.crossOrigin = "anonymous";
        }
    });
    
    // Wait for all image processing
    await Promise.race([
        Promise.all(imagePromises),
        new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    const printWrapper = sandboxDoc.getElementById('print-wrapper');
    if (!printWrapper) {
      throw new PdfExportError('RENDER_FAILED', 'Print layout not found.');
    }

    const totalHeight = printWrapper.scrollHeight;
    const scale = getAdaptiveScale(totalHeight);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const contentEl = sandboxDoc.getElementById('pdf-content') || printWrapper;
    await renderElementToPdf(pdf, printWrapper, contentEl, theme.colors.background, scale);

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
}

/**
 * Triggers native browser print dialog (Save as PDF).
 * Produces 100% vector PDFs with selectable text, clickable links, perfect CSS breaks,
 * and zero memory limits — capable of exporting documents of unlimited length (100+ pages).
 */
export const exportViaBrowserPrint = async (options: PrintOptions): Promise<void> => {
  const theme = getTheme(options.themeId || 'professional');
  const title = options.title || 'document';

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
    const loaded = await Promise.all(stylePromises);
    customStyles = loaded.join('\n');
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
            padding: 10mm 15mm;
            font-family: ${theme.fonts.body};
            color: ${theme.colors.text};
            background-color: #ffffff;
            font-size: ${theme.fontSize.base};
            line-height: ${theme.spacing.lineHeight};
          }
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          @media print {
            body {
              background-color: #ffffff !important;
              color: #111827 !important;
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
