export const PDF_MAX_MARKDOWN_CHARS = 1_500_000;
export const PDF_EXPORT_TIMEOUT_MS = 180_000;
export const PDF_MAX_CANVAS_PIXELS = 80_000_000;

export type PdfExportErrorCode =
  | 'DOCUMENT_TOO_LARGE'
  | 'EXPORT_TIMEOUT'
  | 'RENDER_FAILED'
  | 'MEMORY_LIMIT'
  | 'UNKNOWN';

export class PdfExportError extends Error {
  readonly code: PdfExportErrorCode;

  constructor(code: PdfExportErrorCode, message: string) {
    super(message);
    this.name = 'PdfExportError';
    this.code = code;
  }
}

export function getPdfExportUserMessage(error: unknown): string {
  if (error instanceof PdfExportError) {
    switch (error.code) {
      case 'DOCUMENT_TOO_LARGE':
        return error.message;
      case 'EXPORT_TIMEOUT':
        return 'PDF export timed out. For very large documents, try "Print to PDF (Vector)" in the export menu.';
      case 'MEMORY_LIMIT':
        return 'Browser canvas limit reached for direct export. Please use "Print to PDF (Vector)" from the export menu — it supports unlimited pages.';
      case 'RENDER_FAILED':
        return 'PDF rendering failed. Check images and formatting, or try "Print to PDF (Vector)".';
      default:
        return 'PDF export failed. Try "Print to PDF (Vector)" from the export menu.';
    }
  }
  if (error instanceof Error && /out of memory|allocation failed/i.test(error.message)) {
    return 'Browser ran out of memory. Please use "Print to PDF (Vector)" from the export menu for large files.';
  }
  return 'PDF export failed. Please try again or use "Print to PDF (Vector)".';
}
