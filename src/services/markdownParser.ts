import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Normalizes common Mermaid formatting quirks, copy-paste artifacts from web/chat,
 * smart quotes, non-breaking spaces, zero-width characters, and HTML entities.
 */
export const cleanMermaidCode = (code: string): string => {
  if (!code) return '';

  let cleaned = code
    .replace(/\r\n/g, '\n')
    // Remove zero-width spaces, BOM, joiners
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Replace non-breaking / thin spaces with normal space
    .replace(/[\u00A0\u202F]/g, ' ')
    // Normalize curly / typographical quotes to straight quotes
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Replace Unicode dashes, em-dashes, en-dashes, horizontal bars, minus signs with standard hyphen
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');

  // Decode pre-existing HTML entities (e.g. if copied from rendered HTML or chat)
  for (let i = 0; i < 3; i++) {
    cleaned = cleaned
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  // Normalize common copy-pasted arrows
  cleaned = cleaned
    .replace(/—>>/g, '->>')
    .replace(/–>>/g, '->>')
    .replace(/→/g, '->');

  return cleaned.trim();
};

/**
 * Regex matching any known Mermaid diagram declaration header line.
 */
export const MERMAID_DIAGRAM_KEYWORD_RE =
  /^\s*(?:%%\{[\s\S]*?\}%%\s*)?(?:sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|zenuml|kanban|C4(?:Context|Container|Component|Dynamic|Deployment)|(?:sankey|xychart|block|packet|architecture)-beta|(?:flowchart|graph)\s+(?:TD|TB|BT|RL|LR)|(?:flowchart|graph)\b)/i;

/**
 * Helper to check whether an unindented line after blank lines looks like valid Mermaid syntax.
 */
function isMermaidStatement(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  // Indented line (standard diagram body)
  if (/^\s{2,}|\t/.test(line)) return true;

  // Mermaid keywords
  if (
    /^\s*(?:actor|participant|note|autonumber|loop|alt|opt|par|critical|break|rect|end|subgraph|section|task|title|accTitle|accDescr|classDef|class|style|click|linkStyle|interpolate|activate|deactivate|box|create|destroy|option|parallel|commit|branch|checkout|merge|root|dateFormat|axisFormat|todayMarker|journey|gantt|pie|erDiagram|flowchart|graph|sequenceDiagram|stateDiagram|classDiagram)\b/i.test(
      line
    )
  ) {
    return true;
  }

  // Mermaid connectors, arrows, and node shapes
  if (
    /->|-->|->>|-->>|-x|--x|-\)|--\)|==>|-.-|<--|<-->|o--|--o|x--|--x|\|\|--|\}\||\{|\(|\[/.test(
      line
    )
  ) {
    return true;
  }

  // Mermaid comment or directive
  if (/^\s*%%/.test(line)) return true;

  return false;
}

/**
 * Scans markdown text and extracts any unfenced Mermaid diagram blocks.
 */
function extractUnfencedMermaid(text: string, store: string[]): string {
  const lines = text.split(/\r?\n/);
  const resultLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts an unfenced Mermaid diagram
    if (MERMAID_DIAGRAM_KEYWORD_RE.test(line)) {
      const diagramLines: string[] = [line];
      i++;

      let blankCount = 0;
      while (i < lines.length) {
        const curLine = lines[i];

        // Definite markdown boundaries that immediately terminate an unfenced diagram:
        // 1. Markdown headings (# Heading)
        if (/^\s*#{1,6}\s+\S/.test(curLine)) break;
        // 2. Horizontal rules (--- or ***)
        if (/^\s*[-*_]{3,}\s*$/.test(curLine)) break;
        // 3. Fenced code block delimiters (``` or ~~~)
        if (/^\s*(`{3,}|~{3,})/.test(curLine)) break;
        // 4. Blockquotes (> quote)
        if (/^\s*>\s/.test(curLine)) break;
        // 5. Existing extracted placeholders
        if (/^\s*%%MERMAID_RAW_BLOCK_\d+%%\s*$/.test(curLine)) break;
        // 6. Markdown table rows
        if (/^\s*\|.*\|\s*$/.test(curLine)) break;

        // Blank lines within diagrams are preserved
        if (curLine.trim() === '') {
          blankCount++;
          diagramLines.push(curLine);
          i++;
          continue;
        }

        // If we previously encountered blank line(s), check if this line is markdown prose
        if (blankCount > 0) {
          // Check for markdown list items
          if (/^\s*[-*+]\s+\S/.test(curLine) || /^\s*\d+\.\s+\S/.test(curLine)) {
            break;
          }

          // Check if this unindented line is a valid Mermaid statement
          if (!isMermaidStatement(curLine)) {
            break;
          }
        }

        blankCount = 0;
        diagramLines.push(curLine);
        i++;
      }

      // Trim any trailing blank lines from the diagram
      while (
        diagramLines.length > 0 &&
        diagramLines[diagramLines.length - 1].trim() === ''
      ) {
        diagramLines.pop();
        i--;
      }

      const rawCode = diagramLines.join('\n');
      const idx = store.length;
      store.push(cleanMermaidCode(rawCode));
      resultLines.push(`\n%%MERMAID_RAW_BLOCK_${idx}%%\n`);
      continue;
    }

    resultLines.push(line);
    i++;
  }

  return resultLines.join('\n');
}

export const parseMarkdown = (markdown: string): string => {
  try {
    const content = markdown.replace(/^\s*---[\s\S]*?---\s*/, '');
    const mermaidStore: string[] = [];

    // 1. Extract explicitly fenced Mermaid blocks (```mermaid ... ``` or ~~~mermaid ... ~~~ or ```mmd ... ```)
    const FENCED_MERMAID =
      /(?:^|\n)[ \t]*(`{3,}|~{3,})(?:mermaid|mmd)\s*\r?\n([\s\S]*?)(?:\r?\n[ \t]*\1[ \t]*(?:\n|$)|$)/gi;

    let sanitized = content.replace(FENCED_MERMAID, (_, _fence: string, code: string) => {
      const idx = mermaidStore.length;
      mermaidStore.push(cleanMermaidCode(code));
      return `\n\n%%MERMAID_RAW_BLOCK_${idx}%%\n\n`;
    });

    // Also extract explicit HTML tags if pasted: <div class="mermaid">...</div> or <pre class="mermaid">...</pre>
    const HTML_MERMAID =
      /<(?:div|pre)[^>]*\bclass=["'][^"']*mermaid[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|pre)>/gi;
    sanitized = sanitized.replace(HTML_MERMAID, (_, code: string) => {
      const idx = mermaidStore.length;
      mermaidStore.push(cleanMermaidCode(code));
      return `\n\n%%MERMAID_RAW_BLOCK_${idx}%%\n\n`;
    });

    // 2. Extract unfenced Mermaid diagrams (e.g. sequenceDiagram, flowchart, erDiagram pasted directly)
    sanitized = extractUnfencedMermaid(sanitized, mermaidStore);

    // 3. Parse standard markdown with marked
    let html = marked.parse(sanitized) as string;

    // 4. Inject clean raw mermaid blocks back with data-mermaid attribute and safe HTML escaping
    html = html.replace(
      /<p>\s*%%MERMAID_RAW_BLOCK_(\d+)%%\s*<\/p>|%%MERMAID_RAW_BLOCK_(\d+)%%/gi,
      (_, id1, id2) => {
        const idx = parseInt(id1 || id2, 10);
        const cleanCode = mermaidStore[idx] || '';
        const encoded = encodeURIComponent(cleanCode);
        const safeEscaped = cleanCode
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        return `\n<div class="mermaid" data-mermaid="${encoded}">${safeEscaped}</div>\n`;
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
