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
} from '../lib/exportDocument';

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
                        themeId: effectiveThemeId,
                        margins,
                        smartPageBreaks,
                    });
                } else {
                    await generatePDFFromMarkdown(markdown, {
                        filename: `${base}.pdf`,
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
                    title: base,
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
                                <i className={`bi ${meta.icon}`} aria-hidden />
                                <span>{meta.label}</span>
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
                        <i className="bi bi-sliders" aria-hidden />
                        <span>PDF Margins & Settings...</span>
                    </button>
                </div>
            )}

            {settingsOpen && (
                <div className="pdf-settings-backdrop" onClick={() => setSettingsOpen(false)}>
                    <div className="pdf-settings-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="pdf-settings-header">
                            <h5>
                                <i className="bi bi-aspect-ratio" /> PDF Margins & Page Settings
                            </h5>
                            <button
                                type="button"
                                className="btn-close btn-close-white"
                                onClick={() => setSettingsOpen(false)}
                                aria-label="Close"
                            />
                        </div>
                        <div className="pdf-settings-body">
                            <div className="pdf-settings-section">
                                <label className="pdf-settings-label">Margin Presets</label>
                                <div className="pdf-presets-group">
                                    <button
                                        type="button"
                                        className={`preset-btn ${margins.top === 15 && margins.bottom === 15 && margins.left === 15 && margins.right === 15 ? 'active' : ''}`}
                                        onClick={() => setMargins({ top: 15, right: 15, bottom: 15, left: 15 })}
                                    >
                                        Normal (15mm)
                                    </button>
                                    <button
                                        type="button"
                                        className={`preset-btn ${margins.top === 8 && margins.bottom === 8 && margins.left === 8 && margins.right === 8 ? 'active' : ''}`}
                                        onClick={() => setMargins({ top: 8, right: 8, bottom: 8, left: 8 })}
                                    >
                                        Compact (8mm)
                                    </button>
                                    <button
                                        type="button"
                                        className={`preset-btn ${margins.top === 25 && margins.bottom === 25 && margins.left === 25 && margins.right === 25 ? 'active' : ''}`}
                                        onClick={() => setMargins({ top: 25, right: 25, bottom: 25, left: 25 })}
                                    >
                                        Spacious (25mm)
                                    </button>
                                </div>
                            </div>

                            <div className="pdf-settings-section">
                                <label className="pdf-settings-label">All 4-Side Margins (in millimeters)</label>
                                <div className="margins-inputs-grid">
                                    <div className="margin-field">
                                        <label>Top</label>
                                        <div className="input-group-mm">
                                            <input
                                                type="number"
                                                min={0}
                                                max={60}
                                                value={margins.top}
                                                onChange={(e) => setMargins({ ...margins, top: Math.max(0, Number(e.target.value)) })}
                                            />
                                            <span>mm</span>
                                        </div>
                                    </div>
                                    <div className="margin-field">
                                        <label>Right</label>
                                        <div className="input-group-mm">
                                            <input
                                                type="number"
                                                min={0}
                                                max={60}
                                                value={margins.right}
                                                onChange={(e) => setMargins({ ...margins, right: Math.max(0, Number(e.target.value)) })}
                                            />
                                            <span>mm</span>
                                        </div>
                                    </div>
                                    <div className="margin-field">
                                        <label>Bottom</label>
                                        <div className="input-group-mm">
                                            <input
                                                type="number"
                                                min={0}
                                                max={60}
                                                value={margins.bottom}
                                                onChange={(e) => setMargins({ ...margins, bottom: Math.max(0, Number(e.target.value)) })}
                                            />
                                            <span>mm</span>
                                        </div>
                                    </div>
                                    <div className="margin-field">
                                        <label>Left</label>
                                        <div className="input-group-mm">
                                            <input
                                                type="number"
                                                min={0}
                                                max={60}
                                                value={margins.left}
                                                onChange={(e) => setMargins({ ...margins, left: Math.max(0, Number(e.target.value)) })}
                                            />
                                            <span>mm</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pdf-settings-section smart-breaks-section">
                                <div className="form-check form-switch">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="smartPageBreaksToggle"
                                        checked={smartPageBreaks}
                                        onChange={(e) => setSmartPageBreaks(e.target.checked)}
                                    />
                                    <label className="form-check-label" htmlFor="smartPageBreaksToggle">
                                        <strong>Smart Page Breaks</strong>
                                        <span className="d-block text-muted small">
                                            Prevents cutting headings, code blocks, tables, and diagrams across pages.
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="pdf-settings-footer">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => {
                                    setMargins({ top: 15, right: 15, bottom: 15, left: 15 });
                                    setSmartPageBreaks(true);
                                }}
                            >
                                Reset Defaults
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => handleSaveSettings(margins, smartPageBreaks)}
                            >
                                Apply & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportButton;
