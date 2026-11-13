import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

const MERMAID_FENCE = /```mermaid\s*\r?\n([\s\S]*?)```/gi;

export const parseMarkdown = (markdown: string): string => {
  try {
    const content = markdown.replace(/^\s*---[\s\S]*?---\s*/, '');

    // 1. Extract all mermaid blocks completely BEFORE marked touches them!
    // This prevents marked from misinterpreting blank lines inside diagrams as end-of-HTML-block,
    // converting 4-space indents into <pre><code>, or encoding quotes and arrows into HTML entities.
    const mermaidStore: string[] = [];
    const sanitizedMarkdown = content.replace(MERMAID_FENCE, (_, code: string) => {
      const idx = mermaidStore.length;
      mermaidStore.push(code.trim());
      return `\n\n%%MERMAID_RAW_BLOCK_${idx}%%\n\n`;
    });

    // 2. Parse standard markdown with marked
    let html = marked.parse(sanitizedMarkdown) as string;

    // 3. Inject clean raw mermaid blocks back into <div class="mermaid">
    html = html.replace(
      /<p>\s*%%MERMAID_RAW_BLOCK_(\d+)%%\s*<\/p>|%%MERMAID_RAW_BLOCK_(\d+)%%/gi,
      (_, id1, id2) => {
        const idx = parseInt(id1 || id2, 10);
        const rawCode = mermaidStore[idx] || '';
        const cleanCode = rawCode
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"');
        return `\n<div class="mermaid">\n${cleanCode}\n</div>\n`;
      }
    );

    return html;
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return '<p>Error parsing markdown</p>';
  }
};

export const sanitizeHtml = (html: string): string => {
  return html;
};
