import { FC } from 'react';
import { STEPS } from '../landingData';
import { useNavigate } from 'react-router-dom';

/* ── Micro-Visual 01: Interactive CodeMirror & Upload ── */
const Step1Visual: FC = () => (
  <div className="wf-anim-box wf-anim-editor" aria-hidden="true">
    <div className="wf-editor-topbar">
      <span className="wf-dot red" />
      <span className="wf-dot yellow" />
      <span className="wf-dot green" />
      <span className="wf-file-name">document.md</span>
    </div>
    <div className="wf-editor-content">
      <div className="wf-code-row">
        <span className="wf-tok-h"># </span>
        <span className="wf-tok-title">Architecture RFC</span>
      </div>
      <div className="wf-code-row">
        <span className="wf-tok-meta">&gt; status: </span>
        <span className="wf-tok-val">production</span>
      </div>
      <div className="wf-code-row wf-typing-row">
        <span className="wf-tok-kw">const </span>
        <span className="wf-tok-ident">api</span>
        <span className="wf-tok-op"> = </span>
        <span className="wf-tok-str">"v3"</span>
        <span className="wf-cursor" />
      </div>
    </div>
    <div className="wf-upload-chip">
      <i className="bi bi-cloud-arrow-up-fill" />
      <span>Drop .md or paste</span>
    </div>
  </div>
);

/* ── Micro-Visual 02: Animated Diagram Nodes & Theme Swatches ── */
const Step2Visual: FC = () => (
  <div className="wf-anim-box wf-anim-diagram" aria-hidden="true">
    <div className="wf-diagram-nodes">
      <div className="wf-node node-client">Client</div>
      <div className="wf-node-wire">
        <div className="wf-pulse-packet" />
      </div>
      <div className="wf-node node-api">API</div>
      <div className="wf-node-wire">
        <div className="wf-pulse-packet packet-delay" />
      </div>
      <div className="wf-node node-db">Atlas</div>
    </div>
    <div className="wf-theme-swatches">
      <span className="wf-swatch sw-dark active"><i className="bi bi-moon-stars" /> Dark</span>
      <span className="wf-swatch sw-academic"><i className="bi bi-journal" /> Serif</span>
      <span className="wf-swatch sw-minimal"><i className="bi bi-circle" /> Minimal</span>
    </div>
  </div>
);

/* ── Micro-Visual 03: Page Geometry & Zero-Cut Break ── */
const Step3Visual: FC = () => (
  <div className="wf-anim-box wf-anim-geometry" aria-hidden="true">
    <div className="wf-mini-sheet-stage">
      <div className="wf-mini-sheet">
        <div className="wf-sheet-margin top" />
        <div className="wf-sheet-margin left" />
        <div className="wf-sheet-margin right" />
        <div className="wf-sheet-content">
          <div className="wf-sheet-bar w-80" />
          <div className="wf-sheet-bar w-60" />
          <div className="wf-sheet-smart-break">
            <span className="wf-break-tag"><i className="bi bi-check2" /> No Slices</span>
          </div>
        </div>
      </div>
      <div className="wf-geometry-meta">
        <span className="wf-geo-badge">A4 &bull; 15mm</span>
        <span className="wf-geo-sub">Zero-Cut Seam</span>
      </div>
    </div>
  </div>
);

/* ── Micro-Visual 04: Headless Chromium Vector PDF Export ── */
const Step4Visual: FC = () => (
  <div className="wf-anim-box wf-anim-export" aria-hidden="true">
    <div className="wf-export-beam-wrap">
      <div className="wf-export-label">
        <span><i className="bi bi-cpu" /> Vector Engine</span>
        <span className="wf-percent">100%</span>
      </div>
      <div className="wf-export-track">
        <div className="wf-export-fill" />
      </div>
    </div>
    <div className="wf-pdf-status-card">
      <div className="wf-pdf-icon"><i className="bi bi-file-earmark-pdf-fill" /></div>
      <div className="wf-pdf-info">
        <span className="wf-pdf-name">document.pdf</span>
        <span className="wf-pdf-desc">300 DPI &bull; Vector</span>
      </div>
      <div className="wf-pdf-check"><i className="bi bi-check2" /></div>
    </div>
  </div>
);

export const WorkflowSection: FC = () => {
  const navigate = useNavigate();

  return (
    <section id="lp-workflow" className="lp-section lp-workflow-section">
      <div className="lp-section-inner">
        {/* Header */}
        <div className="lp-section-header text-center mb-5">
          <span className="lp-section-label lp-section-label--center">HOW IT WORKS</span>
          <h2 className="lp-section-title">
            From Raw Markdown to Publication PDF in 4 Simple Steps
          </h2>
          <p className="lp-section-desc mx-auto">
            No complex terminal commands or LaTeX compiling pipelines. Write naturally, visualize live, and export book-quality documents in seconds.
          </p>
        </div>

        {/* 4-Step Cards Grid */}
        <div className="lp-workflow-steps-grid">
          {STEPS.map((step, idx) => (
            <div key={idx} className="lp-step-card">
              <div className="step-card-top">
                <span className="step-number">{step.num}</span>
                <span className="step-tag">{step.tag}</span>
              </div>

              {/* Dynamic Animated Micro-Visual Stage */}
              <div className="step-micro-stage">
                {idx === 0 && <Step1Visual />}
                {idx === 1 && <Step2Visual />}
                {idx === 2 && <Step3Visual />}
                {idx === 3 && <Step4Visual />}
              </div>

              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
              {idx < STEPS.length - 1 && <div className="step-connector-arrow"><i className="bi bi-chevron-right" /></div>}
            </div>
          ))}
        </div>

        <div className="lp-workflow-cta-bar text-center mt-5">
          <button
            type="button"
            className="btn-lp-primary"
            onClick={() => navigate('/editor')}
          >
            <span>Start Writing Free — No Sign-Up Needed</span>
            <i className="bi bi-arrow-right" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default WorkflowSection;
