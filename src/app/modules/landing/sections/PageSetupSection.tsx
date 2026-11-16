import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PDF_PAGE_SIZES, PdfPageSize } from '../../../../services/pdfGenerator';

export const PageSetupSection: FC = () => {
  const navigate = useNavigate();
  const [selectedSize, setSelectedSize] = useState<PdfPageSize>('A4');
  const [marginPreset, setMarginPreset] = useState<'normal' | 'compact' | 'spacious' | 'bleed'>('normal');

  const curDef = PDF_PAGE_SIZES[selectedSize];
  const marginValues = {
    normal: 15,
    compact: 8,
    spacious: 25,
    bleed: 0,
  };
  const curMargin = marginValues[marginPreset];

  const printableW = Math.max(10, curDef.widthMm - curMargin * 2);
  const printableH = Math.max(10, curDef.heightMm - curMargin * 2);
  const coveragePercent = Math.round(((printableW * printableH) / (curDef.widthMm * curDef.heightMm)) * 100);

  // Dynamic preview sheet dimensions
  const sheetHeightPx = 250;
  const sheetWidthPx = Math.round(sheetHeightPx * (curDef.widthMm / curDef.heightMm));

  return (
    <section id="lp-page-setup" className="lp-section lp-page-setup-section">
      <div className="lp-section-inner">
        {/* Header */}
        <div className="lp-section-header text-center mb-5">
          <span className="lp-section-label lp-section-label--center">PAGE GEOMETRY &amp; MARGINS</span>
          <h2 className="lp-section-title">
            Tailor Paper Sizes &amp; Eliminate Page-Break Slices
          </h2>
          <p className="lp-section-desc mx-auto">
            Choose from international ISO and North American formats with millimeter margin control. MD2PDFX automatically ensures clean page breaks without sliced code or orphan headers.
          </p>
        </div>

        <div className="lp-setup-layout-grid">
          {/* Left Column: Interactive Page Sheet Simulator */}
          <div className="lp-setup-preview-card">
            <div className="lp-setup-card-header">
              <span className="lp-setup-badge">
                <i className="bi bi-aspect-ratio" /> Paper Simulator
              </span>
              <span className="lp-setup-dims">
                {curDef.label} &bull; {curDef.widthMm} &times; {curDef.heightMm} mm
              </span>
            </div>

            <div className="lp-setup-paper-stage">
              <div
                className="lp-sim-sheet"
                style={{
                  width: `${sheetWidthPx}px`,
                  height: `${sheetHeightPx}px`,
                }}
              >
                {/* Margin indicators */}
                <div
                  className="lp-sim-margin-band top"
                  style={{ height: `${(curMargin / curDef.heightMm) * 100}%` }}
                />
                <div
                  className="lp-sim-margin-band bottom"
                  style={{ height: `${(curMargin / curDef.heightMm) * 100}%` }}
                />
                <div
                  className="lp-sim-margin-band left"
                  style={{ width: `${(curMargin / curDef.widthMm) * 100}%` }}
                />
                <div
                  className="lp-sim-margin-band right"
                  style={{ width: `${(curMargin / curDef.widthMm) * 100}%` }}
                />

                {/* Printable Content Area */}
                <div
                  className="lp-sim-printable"
                  style={{
                    top: `${(curMargin / curDef.heightMm) * 100}%`,
                    bottom: `${(curMargin / curDef.heightMm) * 100}%`,
                    left: `${(curMargin / curDef.widthMm) * 100}%`,
                    right: `${(curMargin / curDef.widthMm) * 100}%`,
                  }}
                >
                  <div className="lp-sim-doc-header">CloudScale Architecture Spec</div>
                  <div className="lp-sim-line full" />
                  <div className="lp-sim-line p80" />
                  <div className="lp-sim-code-box">
                    <span className="code-dot red" />
                    <span className="code-dot yellow" />
                    <span className="code-dot green" />
                    <div className="code-line" />
                    <div className="code-line w60" />
                  </div>
                  <div className="lp-sim-line p90" />
                </div>
              </div>
            </div>

            {/* Metrics Bar with Clean Cards */}
            <div className="lp-setup-metrics-bar">
              <div className="lp-metric-card">
                <span className="metric-title">Printable Width</span>
                <span className="metric-val">{printableW} mm</span>
              </div>
              <div className="lp-metric-card">
                <span className="metric-title">Printable Height</span>
                <span className="metric-val">{printableH} mm</span>
              </div>
              <div className="lp-metric-card">
                <span className="metric-title">Usable Surface</span>
                <span className="metric-val highlight">{coveragePercent}%</span>
              </div>
            </div>
          </div>

          {/* Right Column: Controls & Features */}
          <div className="lp-setup-controls-card">
            {/* 1. Size Switcher */}
            <div className="lp-control-group">
              <span className="lp-control-label">
                <i className="bi bi-file-earmark-ruled" /> Choose Standard Paper Size
              </span>
              <div className="lp-size-buttons-grid">
                {(
                  [
                    { id: 'A4', label: 'A4', sub: '210 × 297 mm', badge: 'Default' },
                    { id: 'A3', label: 'A3', sub: '297 × 420 mm', badge: 'Posters' },
                    { id: 'A5', label: 'A5', sub: '148 × 210 mm', badge: 'Booklet' },
                    { id: 'Letter', label: 'Letter', sub: '8.5 × 11 in', badge: 'US Standard' },
                    { id: 'Legal', label: 'Legal', sub: '8.5 × 14 in', badge: 'Contracts' },
                  ] as const
                ).map(({ id, label, sub, badge }) => (
                  <button
                    key={id}
                    type="button"
                    className={`lp-size-btn ${selectedSize === id ? 'active' : ''}`}
                    onClick={() => setSelectedSize(id)}
                  >
                    <div className="size-btn-top">
                      <span className="size-name">{label}</span>
                      <span className="size-badge">{badge}</span>
                    </div>
                    <span className="size-sub">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Margin Presets */}
            <div className="lp-control-group">
              <span className="lp-control-label">
                <i className="bi bi-bounding-box" /> 4-Sided Margin Presets
              </span>
              <div className="lp-margin-presets-grid">
                {[
                  { id: 'normal', name: 'Normal', val: '15 mm' },
                  { id: 'compact', name: 'Compact', val: '8 mm' },
                  { id: 'spacious', name: 'Spacious', val: '25 mm' },
                  { id: 'bleed', name: 'Full Bleed', val: '0 mm' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`lp-margin-btn ${marginPreset === p.id ? 'active' : ''}`}
                    onClick={() => setMarginPreset(p.id as any)}
                  >
                    <span className="margin-name">{p.name}</span>
                    <span className="margin-val">{p.val}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Smart Page Breaks Highlights (Zero ugly cut code text!) */}
            <div className="lp-smart-breaks-feature-card">
              <div className="smart-breaks-header">
                <div className="smart-icon"><i className="bi bi-shield-check" /></div>
                <div>
                  <h4 className="smart-title">Smart Page Breaks &amp; Layout Engine</h4>
                  <p className="smart-desc">
                    Unlike basic converters that slice lines across page seams, MD2PDFX computes layout boundaries to keep your documents presentation-ready.
                  </p>
                </div>
              </div>

              <div className="smart-breaks-benefits">
                <div className="benefit-item">
                  <i className="bi bi-check2-circle text-success" />
                  <span><strong>Zero Cut Code:</strong> Snippets and diagrams move intact to the next page.</span>
                </div>
                <div className="benefit-item">
                  <i className="bi bi-check2-circle text-success" />
                  <span><strong>No Orphan Headings:</strong> Headings stay anchored to their follow-up content.</span>
                </div>
                <div className="benefit-item">
                  <i className="bi bi-check2-circle text-success" />
                  <span><strong>Clean Table Rows:</strong> Table boundaries paginate smoothly without broken text.</span>
                </div>
              </div>
            </div>

            <div className="lp-setup-cta-wrap">
              <button
                type="button"
                className="btn-lp-primary w-100"
                onClick={() => navigate('/editor')}
              >
                <span>Try Custom Margins &amp; Page Sizes in Editor</span>
                <i className="bi bi-arrow-right" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PageSetupSection;
