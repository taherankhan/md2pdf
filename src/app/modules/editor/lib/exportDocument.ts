import { parseMarkdown } from '../../../../services/markdownParser';
import {
  MERMAID_DIAGRAM_STYLES,
  mermaidHtmlExportScriptTag,
} from '../../../../services/renderMermaidInDocument';
import { applyThemeToHTML, getTheme } from '../../../../themes/themeConfig';

export type ExportFormat = 'pdf' | 'print' | 'markdown' | 'html';

const sanitizeBasename = (s: string) =>
  s.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 80) || 'document';

/**
 * Returns human-readable document title for PDF metadata and <title> tags.
 */
export function resolveDocumentTitle(
  exportBaseName: string | undefined,
  markdown: string
): string {
  if (
    exportBaseName?.trim() &&
    !/^untitled(\s+document)?$/i.test(exportBaseName.trim())
  ) {
    return exportBaseName.trim();
  }
  const firstHeading = markdown.match(/^#\s+(.+)$/m);
  if (firstHeading && firstHeading[1]?.trim()) {
    // Strip leading/trailing markdown bold/italic/code markup e.g. # **Title** or # _Title_ -> Title
    const cleanHeading = firstHeading[1].trim().replace(/^[*_~`#\s]+|[*_~`#\s]+$/g, '');
    if (cleanHeading) {
      return cleanHeading;
    }
  }
  if (exportBaseName?.trim()) {
    return exportBaseName.trim();
  }
  return 'Document';
}

export function resolveExportBasename(
  exportBaseName: string | undefined,
  markdown: string
): string {
  const title = resolveDocumentTitle(exportBaseName, markdown);
  return sanitizeBasename(title);
}

export function downloadTextFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildThemedHtmlDocument(markdown: string, themeId: string): string {
  const theme = getTheme(themeId);
  const bodyHtml = applyThemeToHTML(parseMarkdown(markdown), theme);
  const title = resolveDocumentTitle(undefined, markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/themes/prism-tomorrow.min.css">
  <style>${MERMAID_DIAGRAM_STYLES}</style>
</head>
<body>
${bodyHtml}
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/prism.min.js"></script>
${mermaidHtmlExportScriptTag()}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const EXPORT_FORMAT_META: Record<
  ExportFormat,
  { label: string; desc: string; extension: string; mime: string; icon: string; badge?: string }
> = {
  pdf: {
    label: 'PDF Document',
    desc: 'Vector PDF via Puppeteer engine',
    extension: 'pdf',
    mime: 'application/pdf',
    icon: 'bi-file-earmark-pdf-fill',
    badge: 'Vector',
  },
  print: {
    label: 'Browser Print',
    desc: 'System print dialog for physical printers',
    extension: 'pdf',
    mime: 'application/pdf',
    icon: 'bi-printer-fill',
    badge: 'System',
  },
  markdown: {
    label: 'Markdown (.md)',
    desc: 'Raw markdown document source',
    extension: 'md',
    mime: 'text/markdown;charset=utf-8',
    icon: 'bi-file-earmark-text',
  },
  html: {
    label: 'HTML Document (.html)',
    desc: 'Standalone themed web page',
    extension: 'html',
    mime: 'text/html;charset=utf-8',
    icon: 'bi-filetype-html',
  },
};
