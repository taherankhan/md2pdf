import { FC } from 'react';
import { COMPARISON_ROWS } from '../landingData';

export const ComparisonSection: FC = () => {
  return (
    <section id="lp-compare" className="lp-section lp-compare-section">
      <div className="lp-section-inner">
        {/* Header */}
        <div className="lp-section-header text-center mb-5">
          <span className="lp-section-label lp-section-label--center">THE COMPETITIVE EDGE</span>
          <h2 className="lp-section-title">
            Why Developers & Creators Choose MD2PDFX
          </h2>
          <p className="lp-section-desc mx-auto">
            Traditional online converters deliver blurry screenshots and cut your code in half. See how MD2PDFX elevates Markdown to publication-grade document publishing.
          </p>
        </div>

        {/* Comparison Table Container */}
        <div className="lp-compare-table-container">
          <div className="lp-compare-table-scroll">
            <table className="lp-compare-table">
              <thead>
                <tr>
                  <th className="col-feature">Capability & Feature</th>
                  <th className="col-md2pdfx">
                    <div className="md2pdfx-th-badge">
                      <span className="th-tag">RECOMMENDED</span>
                      <span className="th-brand">MD2PDFX</span>
                    </div>
                  </th>
                  <th className="col-other">Browser Print (Ctrl+P)</th>
                  <th className="col-other">Basic Online Converters</th>
                  <th className="col-other">Pandoc / CLI Tools</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx} className={row.highlight ? 'row-highlight' : ''}>
                    <td className="cell-feature">
                      <span className="feat-name">{row.feature}</span>
                      <span className="feat-cat">{row.category}</span>
                    </td>
                    <td className="cell-md2pdfx">
                      <div className="cell-val-wrap">
                        <i className="bi bi-check-circle-fill text-success" />
                        <span className="val-text-strong">{row.md2pdfx}</span>
                      </div>
                    </td>
                    <td className="cell-other">
                      <div className="cell-val-wrap">
                        <i className="bi bi-dash-circle text-muted" />
                        <span className="val-text">{row.browserPrint}</span>
                      </div>
                    </td>
                    <td className="cell-other">
                      <div className="cell-val-wrap">
                        <i className="bi bi-x-circle text-danger" />
                        <span className="val-text">{row.onlineConverters}</span>
                      </div>
                    </td>
                    <td className="cell-other">
                      <div className="cell-val-wrap">
                        <i className="bi bi-info-circle text-muted" />
                        <span className="val-text">{row.pandocCli}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;
