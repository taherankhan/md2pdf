import puppeteer, { Browser } from 'puppeteer-core';
import { existsSync } from 'fs';

export interface GeneratePdfOptions {
  html: string;
  title?: string;
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  smartPageBreaks?: boolean;
  pageSize?: string;
}

/**
 * Auto-detects installed Google Chrome or Microsoft Edge executable path.
 */
export function getChromeExecutablePath(): string {
  const customPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (customPath && existsSync(customPath)) {
    return customPath;
  }

  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : '',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Chrome/Chromium executable not found. Please install Google Chrome or set CHROME_PATH environment variable.'
  );
}

let cachedBrowser: Browser | null = null;

async function getOrLaunchBrowser(): Promise<Browser> {
  if (cachedBrowser && cachedBrowser.connected) {
    return cachedBrowser;
  }

  const executablePath = getChromeExecutablePath();
  cachedBrowser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=medium',
      '--disable-extensions',
    ],
  });

  cachedBrowser.on('disconnected', () => {
    cachedBrowser = null;
  });

  return cachedBrowser;
}

/**
 * Generates a 100% native vector PDF buffer via Headless Chromium / Puppeteer.
 */
export async function generatePdfBuffer(options: GeneratePdfOptions): Promise<Buffer> {
  const browser = await getOrLaunchBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    // Inject content into page
    await page.setContent(options.html, {
      waitUntil: 'load',
      timeout: 30000,
    });

    // Wait for all Mermaid diagram SVGs to complete rendering
    await page.waitForFunction(
      () => {
        const mermaidNodes = document.querySelectorAll('.mermaid');
        if (mermaidNodes.length === 0) return true;
        return Array.from(mermaidNodes).every(
          (el) => el.querySelector('svg') !== null || el.textContent?.includes('Syntax Error')
        );
      },
      { timeout: 15000 }
    ).catch(() => {
      // Continue even if a diagram had a syntax error
    });

    // Ensure document.title matches the requested document title so Chromium sets /Title in PDF metadata
    const docTitle = (options.title && options.title.trim()) || 'Document';
    await page.evaluate((title) => {
      document.title = title;
    }, docTitle);

    // Wait for document fonts to settle
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });

    // Brief settling delay for SVGs and animations
    await new Promise((r) => setTimeout(r, 350));

    const margins = options.margins || { top: 15, right: 15, bottom: 15, left: 15 };
    const validFormats = ['A4', 'A3', 'A5', 'Letter', 'Legal'] as const;
    const requestedFormat = (
      options.pageSize && validFormats.includes(options.pageSize as any)
        ? options.pageSize
        : 'A4'
    ) as any;

    const pdfUint8Array = await page.pdf({
      format: requestedFormat,
      printBackground: true,
      tagged: true,
      margin: {
        top: `${margins.top ?? 15}mm`,
        right: `${margins.right ?? 15}mm`,
        bottom: `${margins.bottom ?? 15}mm`,
        left: `${margins.left ?? 15}mm`,
      },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    await page.close().catch(() => {});
  }
}
