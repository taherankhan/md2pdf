import { FC, useEffect, useRef, useState } from 'react';
import {
    generatePDFFromElement,
    generatePDFFromMarkdown,
    exportViaBrowserPrint,
    PdfMargins,
    DEFAULT_PDF_MARGINS,
} from '../../../../services/pdfGenerator';
import {
    getPdfExportUserMessage,
    PDF_MAX_MARKDOWN_CHARS,
} from '../../../../services/pdfErrors';
import { toast } from 'react-toastify';
import { getTheme } from '../../../../themes/themeConfig';
import { AnalyticsService } from '../../../../services/AnalyticsService';
import {
    buildThemedHtmlDocument,
    downloadTextFile,
    EXPORT_FORMAT_META,
    ExportFormat,
    resolveExportBasename,
    resolveDocumentTitle,
} from '../lib/exportDocument';
import { PdfSettingsModal } from './PdfSettingsModal';

interface ExportButtonProps {
    markdown: string;
    themeId?: string;
    previewRef: React.RefObject<HTMLDivElement>;
    disabled?: boolean;
    exportBaseName?: string;
}

const ExportButton: FC<ExportButtonProps> = ({
    markdown,
    themeId,
    previewRef,
    disabled,
    exportBaseName,
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
    const [margins, setMargins] = useState<PdfMargins>(() => {
        try {
            const saved = localStorage.getItem('md2pdf_margins');
            if (saved) return JSON.parse(saved);
        } catch {}
        return DEFAULT_PDF_MARGINS;
    });
    const [smartPageBreaks, setSmartPageBreaks] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('md2pdf_smart_breaks');
            if (saved !== null) return JSON.parse(saved);
        } catch {}
        return true;
    });

    const rootRef = useRef<HTMLDivElement>(null);

    const theme = getTheme(themeId || 'professional');
    const effectiveThemeId = themeId || 'professional';

    useEffect(() => {
        if (!menuOpen) return;
        const onDoc = (e: MouseEvent) => {
            if (rootRef.current?.contains(e.target as Node)) return;
            setMenuOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [menuOpen]);

    const handleSaveSettings = (newMargins: PdfMargins, breaks: boolean) => {
        setMargins(newMargins);
        setSmartPageBreaks(breaks);
        try {
            localStorage.setItem('md2pdf_margins', JSON.stringify(newMargins));
            localStorage.setItem('md2pdf_smart_breaks', JSON.stringify(breaks));
        } catch {}
        setSettingsOpen(false);
        toast.success('Page layout & margin settings saved!');
    };

    const runExport = async (format: ExportFormat) => {
        if (format === 'pdf' && markdown.length > PDF_MAX_MARKDOWN_CHARS) {
            toast.error(
                `Document is too large to export (${(markdown.length / 1000).toFixed(0)}k characters). ` +
                    `Maximum is ${(PDF_MAX_MARKDOWN_CHARS / 1000).toFixed(0)}k. Shorten content or split the file.`,
                { autoClose: 8000 }
            );
            return;
        }

        const base = resolveExportBasename(exportBaseName, markdown);
        const docTitle = resolveDocumentTitle(exportBaseName, markdown);
        const meta = EXPORT_FORMAT_META[format];

        try {
            setIsExporting(true);
            AnalyticsService.events.exportDocument(format, effectiveThemeId, markdown.length);

            if (format === 'pdf') {
                const previewRoot = previewRef?.current;
                const iframe = previewRoot?.querySelector('iframe');
                const hasLivePreview = Boolean(
                    iframe?.contentDocument?.getElementById('preview-content')
                );

                if (hasLivePreview && previewRoot) {
                    await generatePDFFromElement(previewRoot, {
                        filename: `${base}.pdf`,
                        documentTitle: docTitle,
                        themeId: effectiveThemeId,
                        margins,
                        smartPageBreaks,
                    });
                } else {
                    await generatePDFFromMarkdown(markdown, {
                        filename: `${base}.pdf`,
                        documentTitle: docTitle,
                        themeId: effectiveThemeId,
                        margins,
                        smartPageBreaks,
                    });
                }
            } else if (format === 'print') {
                const previewRoot = previewRef?.current;
                await exportViaBrowserPrint({
                    element: previewRoot,
                    markdown,
                    themeId: effectiveThemeId,
                    title: docTitle,
                    margins,
                });
            } else if (format === 'markdown') {
                downloadTextFile(markdown, `${base}.md`, meta.mime);
            } else {
                const html = buildThemedHtmlDocument(markdown, effectiveThemeId);
                downloadTextFile(html, `${base}.html`, meta.mime);
            }
        } catch (error) {
            if (format === 'pdf' || format === 'print') {
                toast.error(getPdfExportUserMessage(error), { autoClose: 8000 });
            } else {
                toast.error('Export failed. Please try again.', { autoClose: 5000 });
            }
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrimaryExport = () => {
        void runExport(selectedFormat);
    };

    const handlePickFormat = (format: ExportFormat) => {
        setSelectedFormat(format);
        setMenuOpen(false);
        void runExport(format);
    };

    return (
        <div className="export-menu" ref={rootRef}>
            <div className="export-menu-trigger">
                <button
                    type="button"
                    className="export-menu-main btn-export-pdf"
                    onClick={handlePrimaryExport}
                    disabled={isExporting || disabled}
                    title={`Export as ${EXPORT_FORMAT_META[selectedFormat].label}`}
                    style={{
                        background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                    }}
                >
                    {isExporting ? (
                        <>
                            <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-hidden="true"
                            />
                            <span>Exporting…</span>
                        </>
                    ) : (
                        <>
                            <i className={`bi ${EXPORT_FORMAT_META[selectedFormat].icon}`} />
                            <span>Export</span>
                        </>
                    )}
                </button>
                <button
                    type="button"
                    className="export-menu-chevron btn-export-pdf"
                    onClick={() => setMenuOpen((o) => !o)}
                    disabled={isExporting || disabled}
                    aria-expanded={menuOpen}
                    aria-haspopup="listbox"
                    title="Choose export format & settings"
                    style={{
                        background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                    }}
                >
                    <i className={`bi bi-chevron-${menuOpen ? 'up' : 'down'}`} aria-hidden />
                </button>
            </div>

            {menuOpen && (
                <div className="export-menu-dropdown" role="listbox" aria-label="Export format">
                    <div className="export-menu-header">
                        <span>Export Format</span>
                    </div>
                    {(['pdf', 'print', 'markdown', 'html'] as const).map((format) => {
                        const meta = EXPORT_FORMAT_META[format];
                        const active = selectedFormat === format;
                        return (
                            <button
                                key={format}
                                type="button"
                                role="option"
                                aria-selected={active}
                                className={`export-menu-item ${active ? 'active' : ''}`}
                                onClick={() => handlePickFormat(format)}
                            >
                                <div className={`export-menu-item-icon-wrap icon-${format}`}>
                                    <i className={`bi ${meta.icon}`} aria-hidden />
                                </div>
                                <div className="export-menu-item-text">
                                    <div className="export-menu-item-title-row">
                                        <span className="export-menu-item-title">{meta.label}</span>
                                        {meta.badge && (
                                            <span className={`export-menu-badge badge-${format}`}>
                                                {meta.badge}
                                            </span>
                                        )}
                                    </div>
                                    <span className="export-menu-item-desc">{meta.desc}</span>
                                </div>
                                {active && (
                                    <i className="bi bi-check2 export-menu-item-check" aria-hidden />
                                )}
                            </button>
                        );
                    })}
                    <div className="export-menu-divider" />
                    <button
                        type="button"
                        className="export-menu-item export-menu-settings-btn"
                        onClick={() => {
                            setMenuOpen(false);
                            setSettingsOpen(true);
                        }}
                    >
                        <div className="export-menu-item-icon-wrap icon-settings">
                            <i className="bi bi-sliders2-vertical" aria-hidden />
                        </div>
                        <div className="export-menu-item-text">
                            <span className="export-menu-item-title">PDF Margins & Settings...</span>
                            <span className="export-menu-item-desc">A4 margins, page breaks & live sheet preview</span>
                        </div>
                    </button>
                </div>
            )}

            <PdfSettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                margins={margins}
                smartPageBreaks={smartPageBreaks}
                onSave={handleSaveSettings}
                documentTitle={resolveDocumentTitle(exportBaseName, markdown)}
            />
        </div>
    );
};

export default ExportButton;
