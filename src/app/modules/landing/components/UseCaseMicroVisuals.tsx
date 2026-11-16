import { FC } from 'react';

/* ── 01: Architecture & Engineering Specs Micro-Visual ── */
export const ArchitectureMicroVisual: FC = () => (
  <div className="lp-uc-stage lp-uc-arch-stage" aria-hidden="true">
    <div className="uc-arch-topbar">
      <span className="uc-dot red" />
      <span className="uc-dot yellow" />
      <span className="uc-dot green" />
      <span className="uc-arch-title">architecture-spec.md</span>
      <span className="uc-arch-tag"><i className="bi bi-diagram-3-fill me-1" />Mermaid v11</span>
    </div>
    <div className="uc-arch-body">
      {/* Mini Code snippet */}
      <div className="uc-arch-code">
        <div className="uc-tok-row"><span className="tok-kw">sequenceDiagram</span></div>
        <div className="uc-tok-row"><span className="tok-var">Client</span><span className="tok-arrow">-&gt;&gt;</span><span className="tok-var">API</span>: <span className="tok-str">POST /auth</span></div>
        <div className="uc-tok-row"><span className="tok-var">API</span><span className="tok-arrow">--&gt;&gt;</span><span className="tok-var">Client</span>: <span className="tok-str">200 JWT</span></div>
      </div>
      {/* Live Topology Diagram */}
      <div className="uc-arch-topology">
        <div className="topo-node topo-client">Client</div>
        <div className="topo-wire">
          <div className="topo-packet" />
        </div>
        <div className="topo-node topo-gateway">Gateway</div>
        <div className="topo-wire">
          <div className="topo-packet packet-delay" />
        </div>
        <div className="topo-node topo-db">Atlas</div>
      </div>
    </div>
  </div>
);

/* ── 02: Professional Resumes & CVs Micro-Visual ── */
export const ResumeMicroVisual: FC = () => (
  <div className="lp-uc-stage lp-uc-resume-stage" aria-hidden="true">
    <div className="uc-resume-sheet">
      <div className="uc-resume-header">
        <div className="uc-resume-avatar">
          <i className="bi bi-person-fill" />
        </div>
        <div className="uc-resume-meta">
          <span className="uc-resume-name">Alex Rivera</span>
          <span className="uc-resume-role">Staff Platform Engineer</span>
        </div>
        <span className="uc-ats-badge"><i className="bi bi-shield-check me-1" />ATS 100%</span>
      </div>

      <div className="uc-resume-divider" />

      <div className="uc-resume-body">
        <div className="uc-resume-bullet">
          <span className="bullet-dot" />
          <span className="bullet-text">Architected Headless Chromium Vector PDF Pipeline</span>
        </div>
        <div className="uc-resume-skills">
          <span className="skill-chip">TypeScript</span>
          <span className="skill-chip">Node.js</span>
          <span className="skill-chip">Puppeteer</span>
          <span className="skill-chip">MongoDB</span>
        </div>
      </div>

      <div className="uc-resume-footer">
        <span className="page-guarantee">✓ Guaranteed Single Page Layout</span>
      </div>
    </div>
  </div>
);

/* ── 03: Academic Papers & Study Guides Micro-Visual ── */
export const AcademicMicroVisual: FC = () => (
  <div className="lp-uc-stage lp-uc-academic-stage" aria-hidden="true">
    <div className="uc-academic-sheet">
      <div className="uc-acad-header">
        <span className="acad-journal">arXiv:2409.1182 [cs.LG] · Academic Journal</span>
        <span className="acad-tag">KaTeX Math</span>
      </div>
      <div className="uc-acad-title">
        High-Throughput Vector Generation via Puppeteer
      </div>
      {/* LaTeX Formula Mockup Box */}
      <div className="uc-acad-formula">
        <span className="math-sym">∇_θ</span>
        <span className="math-expr">L(θ) = E_π [ ∇_θ log π_θ(a|s) · Q(s,a) ]</span>
      </div>
      <div className="uc-acad-footer">
        <span className="acad-cite">[1] Vaswani et al., 2017 · Attention Is All You Need</span>
        <span className="acad-margins">A4 15mm Margins</span>
      </div>
    </div>
  </div>
);

/* ── 04: Business Proposals & SOWs Micro-Visual ── */
export const BusinessProposalMicroVisual: FC = () => (
  <div className="lp-uc-stage lp-uc-business-stage" aria-hidden="true">
    <div className="uc-business-sheet">
      <div className="uc-biz-header">
        <div className="biz-brand">
          <i className="bi bi-briefcase-fill me-1" />
          <span>STATEMENT OF WORK #408</span>
        </div>
        <div className="biz-approved-badge">APPROVED</div>
      </div>

      {/* Mini Deliverables Table */}
      <div className="uc-biz-table">
        <div className="biz-row">
          <span className="col-desc">Phase 1: Architecture & RFC</span>
          <span className="col-val">$12,500</span>
          <span className="col-status status-done">✓ Delivered</span>
        </div>
        <div className="biz-row">
          <span className="col-desc">Phase 2: PDF Vector Engine</span>
          <span className="col-val">$8,000</span>
          <span className="col-status status-active">● Active</span>
        </div>
      </div>

      {/* Signature Seam */}
      <div className="uc-biz-sig-row">
        <span className="sig-label">Authorized Signature:</span>
        <svg className="sig-curve" viewBox="0 0 70 18">
          <path d="M 2 12 Q 15 2, 28 10 T 52 4 T 68 14" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  </div>
);

export const UseCaseVisual: FC<{ num: string }> = ({ num }) => {
  switch (num) {
    case '01': return <ArchitectureMicroVisual />;
    case '02': return <ResumeMicroVisual />;
    case '03': return <AcademicMicroVisual />;
    case '04': return <BusinessProposalMicroVisual />;
    default: return null;
  }
};
