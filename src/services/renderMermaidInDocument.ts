const MERMAID_CDN =
  'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const MERMAID_INIT = `{
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif'
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

/**
 * Render diagrams in any document using the bundled mermaid package (PDF / off-screen export).
 */
export async function renderMermaidInDocument(doc: Document): Promise<void> {
  const nodes = unrenderedMermaidNodes(doc);
  if (!nodes.length) return;

  const { default: mermaid } = await import('mermaid');
  if (!bundledInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      suppressErrorRendering: true,
    });
    bundledInitialized = true;
  }

  for (const node of nodes) {
    try {
      let rawText = node.textContent || node.innerText || '';
      rawText = rawText
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
      node.textContent = rawText.trim();
      await mermaid.run({ nodes: [node], suppressErrors: true });
    } catch (error) {
      console.warn('Mermaid diagram render failed:', error);
      if (!node.querySelector('svg')) {
        node.innerHTML =
          '<pre style="color:#b91c1c;font-size:12px;padding:8px;background:rgba(239,68,68,0.1);border-radius:4px;">Diagram syntax error - check syntax</pre>';
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
  const nodes = [...document.querySelectorAll('.mermaid')].filter((el) => !el.querySelector('svg'));
  for (const node of nodes) {
    try {
      let text = node.textContent || node.innerText || '';
      text = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
      node.textContent = text.trim();
      await mermaid.run({ nodes: [node], suppressErrors: true });
    } catch (e) {
      console.warn('[preview] Mermaid node render failed', e);
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
  const nodes = [...document.querySelectorAll('.mermaid')].filter((el) => !el.querySelector('svg'));
  for (const node of nodes) {
    try {
      let text = node.textContent || node.innerText || '';
      text = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
      node.textContent = text.trim();
      await mermaid.run({ nodes: [node], suppressErrors: true });
    } catch (e) {}
  }
} catch (err) {}
</script>`;
}
