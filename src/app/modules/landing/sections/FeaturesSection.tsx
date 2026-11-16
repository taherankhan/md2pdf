import { FC, CSSProperties } from 'react';
import { STATS } from '../landingData';

type FeatureVisual = 'editor' | 'themes' | 'export' | 'privacy';

type Feature = {
  num: string;
  tag: string;
  title: string;
  desc: string;
  accent: string;
  visual: FeatureVisual;
};

const FEATURES: Feature[] = [
  {
    num: '01',
    tag: 'Core',
    title: 'Pro Editor & Preview',
    desc: 'CodeMirror workspace with Edit, Split, and Preview, formatting toolbar, and debounced live preview.',
    accent: 'violet',
    visual: 'editor',
  },
  {
    num: '02',
    tag: 'Design',
    title: 'Six PDF Themes',
    desc: 'Professional, Academic, Minimal, Creative, Dark, and Resume — tuned for print typography and A4-ready layouts.',
    accent: 'cyan',
    visual: 'themes',
  },
  {
    num: '03',
    tag: 'Output',
    title: 'Puppeteer Vector PDF Engine',
    desc: 'High-fidelity PDF export powered by Headless Chromium. Produces selectable vector text, clickable links, flawless multi-page layouts, and crisp Mermaid diagrams at any zoom level.',
    accent: 'amber',
    visual: 'export',
  },
  {
    num: '04',
    tag: 'Workflow',
    title: 'Cloud Share & Sync',
    desc: 'Share documents via short links with saved titles and automatic real-time sync across collaborators.',
    accent: 'green',
    visual: 'privacy',
  },
];

const FeatureVisualPanel: FC<{ type: FeatureVisual }> = ({ type }) => {
  switch (type) {
    case 'editor':
      return (
        <div className="lp-feat-visual lp-feat-visual--editor-v2" aria-hidden="true">
          <div className="feat-editor-topbar">
            <span className="feat-editor-dot red" />
            <span className="feat-editor-dot yellow" />
            <span className="feat-editor-dot green" />
            <span className="feat-editor-filename">contract.md</span>
            <span className="feat-editor-live-pill"><span className="pulse-green-dot" /> Split Live</span>
          </div>
          <div className="feat-editor-body">
            <div className="feat-editor-code-pane">
              <div className="feat-gutter">
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
              <div className="feat-code-lines">
                <div className="feat-tok-row"><span className="tok-purple"># </span><span className="tok-white">API Spec</span></div>
                <div className="feat-tok-row"><span className="tok-cyan">const </span><span className="tok-yellow">port</span> = <span className="tok-green">8080</span></div>
                <div className="feat-tok-row"><span className="tok-orange">&gt; </span><span className="tok-dim">200 OK</span><span className="feat-caret" /></div>
              </div>
            </div>
            <div className="feat-split-divider" />
            <div className="feat-editor-pv-pane">
              <div className="feat-pv-title">API Spec</div>
              <div className="feat-pv-chip"><i className="bi bi-shield-check me-1" /> port: 8080</div>
              <div className="feat-pv-status"><span className="pv-tag-ready">✓ Validated</span></div>
            </div>
          </div>
        </div>
      );
    case 'themes':
      return (
        <div className="lp-feat-visual lp-feat-visual--themes-v2" aria-hidden="true">
          <div className="feat-themes-deck">
            {/* Academic Paper Sheet (Back Left) */}
            <div className="feat-theme-sheet sheet-academic">
              <div className="sheet-top-line font-serif">Academic Journal</div>
              <div className="sheet-body-lines">
                <span className="sheet-line w-80" />
                <span className="sheet-line w-60" />
              </div>
              <span className="sheet-tag serif-tag">Merriweather</span>
            </div>
            {/* Dark OLED Sheet (Back Right) */}
            <div className="feat-theme-sheet sheet-dark">
              <div className="sheet-top-line font-mono">Dark OLED Mode</div>
              <div className="sheet-body-lines">
                <span className="sheet-line-dark w-70" />
                <span className="sheet-line-dark w-50" />
              </div>
              <span className="sheet-tag dark-tag">Fira Code</span>
            </div>
            {/* Professional Sheet (Front Center) */}
            <div className="feat-theme-sheet sheet-pro">
              <div className="sheet-header-pro">
                <span className="pro-badge">A4</span>
                <span className="pro-title">Professional Print</span>
              </div>
              <div className="sheet-body-lines">
                <span className="sheet-line-pro w-85" />
                <span className="sheet-line-pro w-65" />
              </div>
              <span className="sheet-tag pro-tag">✓ Inter Display</span>
            </div>
          </div>
        </div>
      );
    case 'export':
      return (
        <div className="lp-feat-visual lp-feat-visual--export-v2" aria-hidden="true">
          <div className="feat-export-stage">
            {/* Vector Engine Beam & Precision Document */}
            <div className="feat-export-doc">
              <div className="feat-doc-header">
                <span className="doc-icon"><i className="bi bi-file-earmark-pdf-fill" /></span>
                <span className="doc-meta">Chromium v124</span>
              </div>
              <div className="feat-vector-curve">
                <svg viewBox="0 0 100 24" className="vector-svg-line">
                  <path d="M 0 18 Q 25 4, 50 14 T 100 8" fill="none" stroke="#38bdf8" strokeWidth="2.2" />
                  <circle cx="50" cy="14" r="3.2" fill="#6c63ff" />
                </svg>
              </div>
              <div className="feat-laser-scanner" />
            </div>

            {/* Magnifying Loupe showing 400% Crisp Vector */}
            <div className="feat-vector-loupe">
              <div className="loupe-ring">
                <span className="loupe-mag">400%</span>
                <span className="loupe-text">ZERO PIXELS</span>
                <span className="loupe-crisp">300 DPI</span>
              </div>
            </div>

            {/* Multi-Format Badges */}
            <div className="feat-formats-col">
              <span className="feat-fmt-badge pdf"><i className="bi bi-file-pdf me-1" /> PDF Vector</span>
              <span className="feat-fmt-badge md"><i className="bi bi-markdown me-1" /> Raw .md</span>
              <span className="feat-fmt-badge html"><i className="bi bi-code-slash me-1" /> HTML</span>
            </div>
          </div>
        </div>
      );
    case 'privacy':
      return (
        <div className="lp-feat-visual lp-feat-visual--sync-v2" aria-hidden="true">
          <div className="feat-sync-pipeline">
            {/* Left Node: Client / User */}
            <div className="feat-sync-node client">
              <i className="bi bi-laptop" />
              <span>Client</span>
            </div>

            {/* Glowing Wire with Pulse */}
            <div className="feat-sync-wire">
              <div className="feat-sync-packet" />
              <span className="wire-label">AES-256</span>
            </div>

            {/* Right Node: MongoDB Atlas Vault */}
            <div className="feat-sync-node atlas">
              <i className="bi bi-database-fill-check" />
              <span>Atlas Vault</span>
            </div>
          </div>

          {/* Live Sync Status Bar */}
          <div className="feat-sync-status-row">
            <div className="sync-status-pill">
              <span className="sync-pulse-dot" />
              <span>Auto-Sync Active</span>
              <span className="sync-latency">24ms</span>
            </div>
            <div className="sync-share-chip">
              <i className="bi bi-link-45deg me-1" />
              <span>md2pdfx.com/s/7x9</span>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
};

const FeaturesSection: FC = () => (
  <>
    <div className="lp-stats-bar">
      <div className="lp-stats-inner">
        {STATS.map((s, i) => (
          <div key={s.label} className={`lp-stat-item lp-reveal lp-reveal-delay-${i + 1}`}>
            <div className="lp-stat-value">{s.value}</div>
            <div className="lp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </div>

    <section id="lp-features" className="lp-section lp-features-bg">
      <div className="lp-section-inner">
        <div className="lp-feat-layout">
          <div className="lp-feat-header lp-reveal lp-reveal--sticky">
            <div className="lp-section-label">Features</div>
            <h2 className="lp-section-title">
              Built Into the Editor.<br />
              <span className="lp-feat-title-accent">Nothing Extra.</span>
            </h2>
            <p className="lp-section-desc">
              Every item below is in the app today — CodeMirror editing, live preview, multi-format
              export, Mermaid, and cloud sharing. No account required to start.
            </p>
          </div>

          <div className="lp-feat-matrix">
            <div className="lp-feat-matrix-glow" aria-hidden="true" />
            <div className="lp-feat-matrix-grid">
              {FEATURES.map((feature, i) => (
                <article
                  key={feature.num}
                  className={`lp-feat-node lp-feat-node--${feature.accent} lp-reveal lp-reveal-delay-${(i % 4) + 1}`}
                >
                  <div className="lp-feat-node-corner lp-feat-node-corner--tl" aria-hidden="true" />
                  <div className="lp-feat-node-corner lp-feat-node-corner--br" aria-hidden="true" />

                  <div className="lp-feat-node-top">
                    <span className="lp-feat-num">{feature.num}</span>
                    <span className="lp-feat-tag">{feature.tag}</span>
                  </div>

                  <h3 className="lp-feat-title">{feature.title}</h3>
                  <p className="lp-feat-desc">{feature.desc}</p>

                  <FeatureVisualPanel type={feature.visual} />
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  </>
);

export default FeaturesSection;
