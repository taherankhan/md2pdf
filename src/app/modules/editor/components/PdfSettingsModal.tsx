import { FC, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    PdfMargins,
    DEFAULT_PDF_MARGINS,
    PdfPageSize,
    PDF_PAGE_SIZES,
    DEFAULT_PDF_PAGE_SIZE,
} from '../../../../services/pdfGenerator';

interface PdfSettingsModalProps {
    open: boolean;
    onClose: () => void;
    margins: PdfMargins;
    smartPageBreaks: boolean;
    pageSize?: PdfPageSize;
    onSave: (margins: PdfMargins, smartPageBreaks: boolean, pageSize: PdfPageSize) => void;
    documentTitle?: string;
}

export const PdfSettingsModal: FC<PdfSettingsModalProps> = ({
    open,
    onClose,
    margins: initialMargins,
    smartPageBreaks: initialSmartBreaks,
    pageSize: initialPageSize = DEFAULT_PDF_PAGE_SIZE,
    onSave,
    documentTitle,
}) => {
    const [margins, setMargins] = useState<PdfMargins>(initialMargins);
    const [smartBreaks, setSmartBreaks] = useState<boolean>(initialSmartBreaks);
    const [pageSize, setPageSize] = useState<PdfPageSize>(initialPageSize);

    useEffect(() => {
        if (open) {
            setMargins(initialMargins);
            setSmartBreaks(initialSmartBreaks);
            setPageSize(initialPageSize || DEFAULT_PDF_PAGE_SIZE);
        }
    }, [open, initialMargins, initialSmartBreaks, initialPageSize]);

    if (!open) return null;

    const clamp = (val: number, min = 0, max = 50) => Math.min(max, Math.max(min, val));

    const updateMargin = (side: keyof PdfMargins, value: number) => {
        setMargins((prev) => ({
            ...prev,
            [side]: clamp(value),
        }));
    };

    const curPageSize = PDF_PAGE_SIZES[pageSize] || PDF_PAGE_SIZES.A4;
    const pageWidthMm = curPageSize.widthMm;
    const pageHeightMm = curPageSize.heightMm;

    const printableWidth = Math.max(10, pageWidthMm - margins.left - margins.right);
    const printableHeight = Math.max(10, pageHeightMm - margins.top - margins.bottom);
    const pageArea = pageWidthMm * pageHeightMm;
    const printableArea = printableWidth * printableHeight;
    const coveragePercent = Math.round((printableArea / pageArea) * 100);

    const sheetHeight = 280;
    const sheetWidth = Math.round(sheetHeight * (pageWidthMm / pageHeightMm));

    const isPresetActive = (top: number, right: number, bottom: number, left: number) =>
        margins.top === top &&
        margins.right === right &&
        margins.bottom === bottom &&
        margins.left === left;

    const modalContent = (
        <div className="pdf-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="pdf-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="pdf-modal-header">
                    <div className="pdf-modal-title-wrap">
                        <div className="pdf-modal-icon">
                            <i className="bi bi-file-earmark-pdf" />
                        </div>
                        <div>
                            <h3 className="pdf-modal-title">PDF Page & Margin Setup</h3>
                            <p className="pdf-modal-subtitle">
                                Configure paper size, page margins, printable area bounds, and smart break behavior
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="pdf-modal-close-btn"
                        onClick={onClose}
                        aria-label="Close dialog"
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                </div>

                {/* Body: 2 Columns */}
                <div className="pdf-modal-body">
                    {/* Left Column: Live Interactive Sheet Preview */}
                    <div className="pdf-preview-col">
                        <div className="pdf-preview-header">
                            <span className="pdf-preview-badge">
                                <i className="bi bi-eye" /> Live Page Preview
                            </span>
                            <span className="pdf-preview-dimensions">
                                {curPageSize.label} ({pageWidthMm} × {pageHeightMm} mm)
                            </span>
                        </div>

                        {/* Visual Paper Sheet */}
                        <div className="pdf-sheet-wrapper">
                            <div
                                className="pdf-sheet"
                                style={{
                                    width: `${sheetWidth}px`,
                                    height: `${sheetHeight}px`,
                                }}
                            >
                                {/* Top margin band */}
                                <div
                                    className="pdf-margin-band pdf-margin-band-top"
                                    style={{ height: `${(margins.top / pageHeightMm) * 100}%` }}
                                >
                                    <span className="pdf-margin-pill pill-top">
                                        Top: {margins.top}mm
                                    </span>
                                </div>

                                {/* Bottom margin band */}
                                <div
                                    className="pdf-margin-band pdf-margin-band-bottom"
                                    style={{ height: `${(margins.bottom / pageHeightMm) * 100}%` }}
                                >
                                    <span className="pdf-margin-pill pill-bottom">
                                        Bottom: {margins.bottom}mm
                                    </span>
                                </div>

                                {/* Left margin band */}
                                <div
                                    className="pdf-margin-band pdf-margin-band-left"
                                    style={{
                                        width: `${(margins.left / pageWidthMm) * 100}%`,
                                        top: `${(margins.top / pageHeightMm) * 100}%`,
                                        bottom: `${(margins.bottom / pageHeightMm) * 100}%`,
                                    }}
                                >
                                    <span className="pdf-margin-pill pill-left">
                                        {margins.left}mm
                                    </span>
                                </div>

                                {/* Right margin band */}
                                <div
                                    className="pdf-margin-band pdf-margin-band-right"
                                    style={{
                                        width: `${(margins.right / pageWidthMm) * 100}%`,
                                        top: `${(margins.top / pageHeightMm) * 100}%`,
                                        bottom: `${(margins.bottom / pageHeightMm) * 100}%`,
                                    }}
                                >
                                    <span className="pdf-margin-pill pill-right">
                                        {margins.right}mm
                                    </span>
                                </div>

                                {/* Printable Content Box */}
                                <div
                                    className="pdf-printable-area"
                                    style={{
                                        top: `${(margins.top / pageHeightMm) * 100}%`,
                                        bottom: `${(margins.bottom / pageHeightMm) * 100}%`,
                                        left: `${(margins.left / pageWidthMm) * 100}%`,
                                        right: `${(margins.right / pageWidthMm) * 100}%`,
                                    }}
                                >
                                    {/* Mock Document Content Representation */}
                                    <div className="pdf-mock-doc">
                                        <div className="pdf-mock-heading">
                                            {documentTitle || 'Sample Document Title'}
                                        </div>
                                        <div className="pdf-mock-line line-full" />
                                        <div className="pdf-mock-line line-75" />
                                        <div className="pdf-mock-line line-90" />

                                        {/* Mock diagram box */}
                                        <div className="pdf-mock-diagram">
                                            <div className="mock-diag-node" />
                                            <div className="mock-diag-arrow" />
                                            <div className="mock-diag-node node-accent" />
                                            <div className="mock-diag-arrow" />
                                            <div className="mock-diag-node" />
                                        </div>

                                        <div className="pdf-mock-line line-full" />
                                        <div className="pdf-mock-line line-60" />

                                        {/* Mock table */}
                                        <div className="pdf-mock-table">
                                            <div className="mock-table-row header-row" />
                                            <div className="mock-table-row" />
                                            <div className="mock-table-row" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Live Metrics footer */}
                        <div className="pdf-preview-metrics">
                            <div className="metric-item">
                                <span className="metric-label">Printable Width</span>
                                <span className="metric-value">{printableWidth} mm</span>
                            </div>
                            <div className="metric-divider" />
                            <div className="metric-item">
                                <span className="metric-label">Printable Height</span>
                                <span className="metric-value">{printableHeight} mm</span>
                            </div>
                            <div className="metric-divider" />
                            <div className="metric-item">
                                <span className="metric-label">Page Coverage</span>
                                <span className="metric-value">{coveragePercent}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Settings & Margin Controls */}
                    <div className="pdf-controls-col">
                        {/* Section 1: Page Size / Paper Format */}
                        <div className="pdf-ctrl-section">
                            <label className="pdf-ctrl-label">
                                <i className="bi bi-aspect-ratio" /> Paper Format & Size
                            </label>
                            <div className="pdf-sizes-grid">
                                {(
                                    [
                                        { id: 'A4', label: 'A4', sub: '210×297', tag: 'Standard' },
                                        { id: 'A3', label: 'A3', sub: '297×420', tag: 'Large' },
                                        { id: 'A5', label: 'A5', sub: '148×210', tag: 'Booklet' },
                                        { id: 'Letter', label: 'Letter', sub: '8.5×11"', tag: 'US' },
                                        { id: 'Legal', label: 'Legal', sub: '8.5×14"', tag: 'Extended' },
                                    ] as const
                                ).map(({ id, label, sub, tag }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className={`page-size-card ${pageSize === id ? 'active' : ''}`}
                                        onClick={() => setPageSize(id)}
                                    >
                                        <span className="page-size-name">{label}</span>
                                        <span className="page-size-val">{sub}</span>
                                        <span className="page-size-tag">{tag}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 2: Presets */}
                        <div className="pdf-ctrl-section">
                            <label className="pdf-ctrl-label">
                                <i className="bi bi-bookmark-star" /> Margin Presets
                            </label>
                            <div className="pdf-presets-grid">
                                <button
                                    type="button"
                                    className={`preset-card ${isPresetActive(15, 15, 15, 15) ? 'active' : ''}`}
                                    onClick={() => setMargins({ top: 15, right: 15, bottom: 15, left: 15 })}
                                >
                                    <span className="preset-name">Normal</span>
                                    <span className="preset-val">15 mm</span>
                                </button>
                                <button
                                    type="button"
                                    className={`preset-card ${isPresetActive(8, 8, 8, 8) ? 'active' : ''}`}
                                    onClick={() => setMargins({ top: 8, right: 8, bottom: 8, left: 8 })}
                                >
                                    <span className="preset-name">Compact</span>
                                    <span className="preset-val">8 mm</span>
                                </button>
                                <button
                                    type="button"
                                    className={`preset-card ${isPresetActive(25, 25, 25, 25) ? 'active' : ''}`}
                                    onClick={() => setMargins({ top: 25, right: 25, bottom: 25, left: 25 })}
                                >
                                    <span className="preset-name">Spacious</span>
                                    <span className="preset-val">25 mm</span>
                                </button>
                                <button
                                    type="button"
                                    className={`preset-card ${isPresetActive(0, 0, 0, 0) ? 'active' : ''}`}
                                    onClick={() => setMargins({ top: 0, right: 0, bottom: 0, left: 0 })}
                                >
                                    <span className="preset-name">Full Bleed</span>
                                    <span className="preset-val">0 mm</span>
                                </button>
                            </div>
                        </div>

                        {/* Section 3: Margin Steppers (Top, Right, Bottom, Left) */}
                        <div className="pdf-ctrl-section">
                            <label className="pdf-ctrl-label">
                                <i className="bi bi-bounding-box" /> All 4 Margins (in millimeters)
                            </label>
                            <div className="pdf-margins-editor-grid">
                                {(
                                    [
                                        { key: 'top', label: 'Top Margin', icon: 'bi-arrow-up' },
                                        { key: 'right', label: 'Right Margin', icon: 'bi-arrow-right' },
                                        { key: 'bottom', label: 'Bottom Margin', icon: 'bi-arrow-down' },
                                        { key: 'left', label: 'Left Margin', icon: 'bi-arrow-left' },
                                    ] as const
                                ).map(({ key, label, icon }) => (
                                    <div key={key} className="margin-stepper-card">
                                        <div className="stepper-header">
                                            <i className={`bi ${icon}`} />
                                            <span>{label}</span>
                                        </div>
                                        <div className="stepper-controls">
                                            <button
                                                type="button"
                                                className="stepper-btn"
                                                onClick={() => updateMargin(key, margins[key] - 1)}
                                                disabled={margins[key] <= 0}
                                                aria-label={`Decrease ${label}`}
                                            >
                                                <i className="bi bi-dash" />
                                            </button>
                                            <div className="stepper-input-wrap">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={50}
                                                    value={margins[key]}
                                                    onChange={(e) => updateMargin(key, Number(e.target.value))}
                                                    className="stepper-input"
                                                />
                                                <span className="stepper-unit">mm</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="stepper-btn"
                                                onClick={() => updateMargin(key, margins[key] + 1)}
                                                disabled={margins[key] >= 50}
                                                aria-label={`Increase ${label}`}
                                            >
                                                <i className="bi bi-plus" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 4: Smart Page Breaks Switch */}
                        <div className="pdf-ctrl-section">
                            <label className="pdf-ctrl-label">
                                <i className="bi bi-scissors" /> Page Splitting Behavior
                            </label>
                            <div
                                className="smart-breaks-card"
                                onClick={() => setSmartBreaks(!smartBreaks)}
                            >
                                <div className="smart-breaks-info">
                                    <div className="smart-breaks-title">
                                        <span>Smart Page Breaks</span>
                                        <span className={`status-tag ${smartBreaks ? 'tag-enabled' : 'tag-disabled'}`}>
                                            {smartBreaks ? 'Recommended' : 'Off'}
                                        </span>
                                    </div>
                                    <p className="smart-breaks-desc">
                                        Prevents ugly page cuts through code blocks, tables, diagrams,
                                        and headings by shifting them cleanly to the next page.
                                    </p>
                                </div>
                                <div className="smart-breaks-toggle-wrap">
                                    <input
                                        type="checkbox"
                                        id="smartBreakModalSwitch"
                                        className="form-check-input smart-switch-input"
                                        checked={smartBreaks}
                                        onChange={(e) => setSmartBreaks(e.target.checked)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="pdf-modal-footer">
                    <button
                        type="button"
                        className="modal-btn-ghost"
                        onClick={() => {
                            setMargins(DEFAULT_PDF_MARGINS);
                            setSmartBreaks(true);
                            setPageSize(DEFAULT_PDF_PAGE_SIZE);
                        }}
                    >
                        <i className="bi bi-arrow-counterclockwise" /> Reset Defaults
                    </button>
                    <div className="modal-footer-actions">
                        <button type="button" className="modal-btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="modal-btn-primary"
                            onClick={() => {
                                onSave(margins, smartBreaks, pageSize);
                            }}
                        >
                            <i className="bi bi-check2" /> Apply & Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
export default PdfSettingsModal;

    return createPortal(modalContent, document.body);
};
export default PdfSettingsModal;
