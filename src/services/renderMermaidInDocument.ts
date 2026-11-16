import { cleanMermaidCode } from './markdownParser';

const MERMAID_CDN =
  'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const MERMAID_INIT = `{
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  suppressErrorRendering: true
}`;

export const MERMAID_DIAGRAM_STYLES = `
.mermaid {
  display: flex;
  justify-content: center;
  margin: 1.25rem 0;
  max-width: 100%;
  overflow-x: auto;
}
.mermaid svg {
  max-width: 100%;
  height: auto;
}
`;

function unrenderedMermaidNodes(doc: Document): HTMLElement[] {
  return Array.from(doc.querySelectorAll<HTMLElement>('.mermaid')).filter(
    (el) => !el.querySelector('svg')
  );
}

let bundledInitialized = false;

function extractNodeCode(node: HTMLElement): string {
  const data = node.getAttribute('data-mermaid');
  if (data) {
    try {
      return decodeURIComponent(data);
    } catch {
      // fallback to textContent
    }
  }
  const rawText = node.textContent || node.innerText || '';
  return cleanMermaidCode(rawText);
}

function checkAndSanitizeErrorSvg(node: HTMLElement): boolean {
  const svg = node.querySelector('svg');
  if (!svg) return false;
  const isError =
    svg.getAttribute('aria-roledescription') === 'error' ||
    (svg.id && svg.id.includes('error')) ||
    Boolean(svg.querySelector('.error-icon')) ||
    Boolean(svg.textContent && svg.textContent.includes('Syntax error in text'));
  if (isError) {
    node.innerHTML =
      '<div style="margin:1rem 0;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-family:sans-serif;font-size:12px;">⚠️ <strong>Mermaid Diagram Syntax Error:</strong> Please verify diagram syntax.</div>';
    return true;
  }
  return false;
}

/**
 * Render diagrams in any document using the bundled mermaid package (PDF / off-screen export).
 */
export async function renderMermaidInDocument(doc: Document, isDark = false): Promise<void> {
  const nodes = unrenderedMermaidNodes(doc);
  if (!nodes.length) return;

  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'neutral',
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, sans-serif',
    suppressErrorRendering: true,
  });

  for (const node of nodes) {
    try {
      const code = extractNodeCode(node);
      node.textContent = code;
      await mermaid.run({ nodes: [node], suppressErrors: true });
      checkAndSanitizeErrorSvg(node);
    } catch (error) {
      console.warn('Mermaid diagram render failed:', error);
      if (!node.querySelector('svg')) {
        node.innerHTML =
          '<div style="margin:1rem 0;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-family:sans-serif;font-size:12px;">⚠️ <strong>Mermaid Diagram Syntax Error:</strong> Please verify diagram syntax.</div>';
      }
    }
  }
}

/** Wait for layout after SVG injection (PDF capture) */
export function waitForMermaidPaint(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Inline module for preview iframe.
 */
export function mermaidPreviewScriptTag(): string {
  return `<script type="module">
import mermaid from '${MERMAID_CDN}';
try {
  mermaid.initialize(${MERMAID_INIT});

  const decodeData = (el) => {
    let raw = el.getAttribute('data-mermaid');
    let code = '';
    if (raw) {
      try {
        code = decodeURIComponent(raw);
      } catch (e) {}
    }
    if (!code) {
      code = el.textContent || el.innerText || '';
    }
    return code
      .replace(/\\r\\n/g, '\\n')
      .replace(/[\\u200B-\\u200D\\uFEFF]/g, '')
      .replace(/[\\u00A0\\u202F]/g, ' ')
      .replace(/[\\u201C\\u201D\\u201E\\u201F\\u00AB\\u00BB]/g, '"')
      .replace(/[\\u2018\\u2019\\u201A\\u201B]/g, "'")
      .replace(/[\\u2010-\\u2015\\u2212\\uFE58\\uFE63\\uFF0D]/g, '-')
      .replace(/—>>/g, '->>')
      .replace(/–>>/g, '->>')
      .replace(/→/g, '->')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .trim();
  };

  const nodes = [...document.querySelectorAll('.mermaid')].filter((el) => !el.querySelector('svg'));
  for (const node of nodes) {
    try {
      const code = decodeData(node);
      node.textContent = code;
      await mermaid.run({ nodes: [node], suppressErrors: true });
      const svg = node.querySelector('svg');
      if (svg && (
        svg.getAttribute('aria-roledescription') === 'error' ||
        (svg.id && svg.id.includes('error')) ||
        Boolean(svg.querySelector('.error-icon')) ||
        Boolean(svg.textContent && svg.textContent.includes('Syntax error in text'))
      )) {
        node.innerHTML = '<div style="margin:1rem 0;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-family:sans-serif;font-size:12px;">⚠️ <strong>Mermaid Diagram Syntax Error:</strong> Please verify diagram syntax.</div>';
      }
    } catch (e) {
      console.warn('[preview] Mermaid node render failed', e);
      if (!node.querySelector('svg')) {
        node.innerHTML = '<div style="margin:1rem 0;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-family:sans-serif;font-size:12px;">⚠️ <strong>Mermaid Diagram Syntax Error:</strong> Please verify diagram syntax.</div>';
      }
    }
  }
} catch (err) {
  console.error('[preview] Mermaid global failed', err);
}
</script>`;
}

/**
 * Scripts for downloaded .html exports (opens in browser with live render).
 */
export function mermaidHtmlExportScriptTag(): string {
  return `<script type="module">
import mermaid from '${MERMAID_CDN}';
try {
  mermaid.initialize(${MERMAID_INIT});

  const decodeData = (el) => {
    let raw = el.getAttribute('data-mermaid');
    let code = '';
    if (raw) {
      try {
        code = decodeURIComponent(raw);
      } catch (e) {}
    }
    if (!code) {
      code = el.textContent || el.innerText || '';
    }
    return code
      .replace(/\\r\\n/g, '\\n')
      .replace(/[\\u200B-\\u200D\\uFEFF]/g, '')
      .replace(/[\\u00A0\\u202F]/g, ' ')
      .replace(/[\\u201C\\u201D\\u201E\\u201F\\u00AB\\u00BB]/g, '"')
      .replace(/[\\u2018\\u2019\\u201A\\u201B]/g, "'")
      .replace(/[\\u2010-\\u2015\\u2212\\uFE58\\uFE63\\uFF0D]/g, '-')
      .replace(/—>>/g, '->>')
      .replace(/–>>/g, '->>')
      .replace(/→/g, '->')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .trim();
  };

  const nodes = [...document.querySelectorAll('.mermaid')].filter((el) => !el.querySelector('svg'));
  for (const node of nodes) {
    try {
      const code = decodeData(node);
      node.textContent = code;
      await mermaid.run({ nodes: [node], suppressErrors: true });
    } catch (e) {}
  }
} catch (err) {}
</script>`;
}
