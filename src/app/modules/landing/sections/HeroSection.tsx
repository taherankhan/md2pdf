import { FC, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HERO_FEATURE_CHIPS, PdfTheme, THEMES, themeSwatchBg } from '../landingData';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { scrollToSection } from '../utils/scrollTo';
import { AnalyticsService } from '../../../../services/AnalyticsService';

type Props = {
  selectedTheme: PdfTheme;
  onThemeChange: (theme: PdfTheme) => void;
};

const HERO_TITLE = {
  lead: 'Write in Markdown.',
  accent: 'Ship a print-ready PDF.',
} as const;

const HeroSection: FC<Props> = ({ selectedTheme, onThemeChange }) => {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [isAutoCycle, setIsAutoCycle] = useState<boolean>(true);

  // Auto-cycle themes every 3 seconds for a dynamic animated showcase
  useEffect(() => {
    if (!isAutoCycle || reducedMotion) return;
    const timer = setInterval(() => {
      const currentIdx = THEMES.findIndex((th) => th.name === selectedTheme.name);
      const nextIdx = (currentIdx + 1) % THEMES.length;
      onThemeChange(THEMES[nextIdx]);
    }, 3000);
    return () => clearInterval(timer);
  }, [isAutoCycle, reducedMotion, selectedTheme, onThemeChange]);

  /*
    Animation class helper.
    When reducedMotion is true we omit the class so no animation plays.
    Each class maps to a @keyframes rule in LandingPage.css (see below).
  */
  const anim = (cls: string) => (reducedMotion ? '' : cls);

  return (
    <>
      <section id="lp-hero" className="lp-hero">
        <div className="lp-hero-inner">

          {/* ── Kicker row ──────────────────────────────── */}
          <div className="lp-hero-kicker">
            <span className={`lp-hero-kicker-file ${anim('lp-anim-kicker lp-anim-d1')}`}>
              document.md
            </span>
            <span
              className={`lp-hero-kicker-arrow ${anim('lp-anim-kicker lp-anim-d2')}`}
              aria-hidden="true"
            >
              →
            </span>
            <span className={`lp-hero-kicker-file lp-hero-kicker-file--out ${anim('lp-anim-kicker lp-anim-d3')}`}>
              export.pdf · .md · .html
            </span>
            <span
              className={`lp-hero-kicker-sep ${anim('lp-anim-kicker lp-anim-d4')}`}
              aria-hidden="true"
            />
            <span className={`lp-hero-kicker-label ${anim('lp-anim-kicker lp-anim-d5')}`}>
              vector pdf · puppeteer
            </span>
          </div>

          {/* ── Hero title ──────────────────────────────── */}
          <h1 className="lp-hero-title">
            <span className="lp-hero-title-line">{HERO_TITLE.lead}</span>
            <span
              className={`lp-hero-title-line lp-hero-title-line--accent${reducedMotion ? ' lp-hero-title-line--static' : ''}`}
            >
              {HERO_TITLE.accent}
            </span>
          </h1>

          {/* ── Subtitle (no entrance animation — Lighthouse LCP element) */}
          <p className="lp-hero-sub">
            Next-generation Markdown studio with live split preview, native Mermaid diagrams, and high-precision vector PDF export powered by Headless Chromium. Crystal-clear text, perfect page breaks, and zero image slicing.
          </p>

          <ul className="lp-hero-chips" aria-label="Editor highlights">
            {HERO_FEATURE_CHIPS.map((chip) => (
              <li key={chip} className="lp-hero-chip">
                {chip}
              </li>
            ))}
          </ul>

          {/* ── CTA buttons ─────────────────────────────── */}
          <div className={`lp-hero-actions ${anim('lp-anim-rise lp-anim-d9')}`}>
            <button
              id="lp-hero-cta-primary"
              className="lp-btn-primary lp-btn--interactive"
              type="button"
              onClick={() => {
                AnalyticsService.events.landingCta('hero_open_editor');
                navigate('/editor');
              }}
            >
              Open Editor
            </button>
            <button
              id="lp-hero-cta-secondary"
              className="lp-btn-ghost lp-btn--interactive"
              type="button"
              onClick={() => {
                AnalyticsService.events.landingNav('lp-features');
                scrollToSection('lp-features');
              }}
            >
              See features
            </button>
          </div>
        </div>
      </section>

      {/* ── Redesigned Modern Studio Mockup Window ────────────────────────────────────────── */}
      <section className="lp-hero-mockup-section">
        <div className={`lp-hero-mockup-inner ${anim('lp-anim-mockup')}`}>
          <div className="lp-hero-mockup">
            <div className="lp-mockup-window" role="img" aria-label="Editor preview">
              
              {/* Topbar */}
              <div className="lp-mockup-topbar">
                <div className="lp-mockup-dots">
                  <span className="lp-mockup-dot lp-mockup-dot-red" />
                  <span className="lp-mockup-dot lp-mockup-dot-amber" />
                  <span className="lp-mockup-dot lp-mockup-dot-green" />
                </div>

                {/* Proper document title tab with icon and cloud sync indicator */}
                <div className="lp-mockup-tab active">
                  <i className="bi bi-file-earmark-code-fill lp-tab-icon" />
                  <span className="lp-mockup-title">taheran-resume.md</span>
                  <span className="lp-mockup-sync-badge" title="Saved to MongoDB Atlas Cloud Vault">
                    <span className="lp-mockup-sync-dot" />
                    Synced
                  </span>
                </div>

                <div className="lp-mockup-topbar-actions">
                  {/* Theme Switcher & Preview Swatches */}
                  <div className="lp-mockup-theme-picker">
                    <span className="lp-mockup-theme-label">Theme</span>

                    <div className="lp-mockup-theme-dots">
                      {THEMES.map((th) => (
                        <button
                          key={th.name}
                          type="button"
                          onClick={() => {
                            setIsAutoCycle(false);
                            AnalyticsService.events.landingThemePreview(th.name);
                            onThemeChange(th);
                          }}
                          title={`${th.name}: ${th.desc}`}
                          aria-label={`Select ${th.name} theme`}
                          className={`lp-mockup-theme-dot${selectedTheme.name === th.name ? ' active' : ''}`}
                          style={{ background: themeSwatchBg(th.name, th.bg) }}
                        />
                      ))}
                    </div>

                    <span className="lp-mockup-theme-tag">
                      {selectedTheme.name}
                    </span>
                  </div>

                  <span className="lp-mockup-pill" title="Share link">
                    <i className="bi bi-share-fill me-1" /> Share
                  </span>
                  <span className="lp-mockup-pill lp-mockup-pill--accent" title="Vector PDF export">
                    <i className="bi bi-file-earmark-pdf-fill me-1" /> Export
                  </span>
                  <button
                    type="button"
                    className="lp-mockup-open-btn"
                    onClick={() => {
                      AnalyticsService.events.landingCta('hero_mockup_open');
                      navigate('/editor');
                    }}
                  >
                    Open in Editor →
                  </button>
                </div>
              </div>

              {/* 2s Animated theme transition progress bar */}
              <div className="lp-mockup-cycle-bar-track">
                <div
                  key={`${selectedTheme.name}-${isAutoCycle}`}
                  className={`lp-mockup-cycle-bar-fill ${isAutoCycle ? 'running' : 'paused'}`}
                />
              </div>

              {/* Split Body: CodeMirror Left + Live Vector PDF Right */}
              <div className="lp-mockup-body">
                {/* Left: Markdown Editor with Line Numbers */}
                <div className="lp-mockup-editor-col">
                  <div className="lp-editor-gutter" aria-hidden="true">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                    <span>6</span>
                    <span>7</span>
                    <span>8</span>
                    <span>9</span>
                    <span>10</span>
                    <span>11</span>
                    <span>12</span>
                    <span>13</span>
                  </div>
                  <div className="lp-mockup-panel lp-editor-code">
                    <div className="tok-h"><span className="tok-sym"># </span>My Professional Resume</div>
                    <div className="tok-blank">&nbsp;</div>
                    <div className="tok-bold"><span className="tok-sym">**</span>Taheran Khan<span className="tok-sym">**</span> <span className="tok-dim">·</span> Full Stack Engineer</div>
                    <div className="tok-blank">&nbsp;</div>
                    <div className="tok-h"><span className="tok-sym">## </span>Experience</div>
                    <div className="tok-list"><span className="tok-bullet">-</span> Full Stack Engineer (2+ years)</div>
                    <div className="tok-blank">&nbsp;</div>
                    <div className="tok-h"><span className="tok-sym">## </span>Skills</div>
                    <div className="tok-code-row">
                      <span className="tok-code">`Node`</span>{' '}
                      <span className="tok-code">`React`</span>{' '}
                      <span className="tok-code">`Mongo`</span>{' '}
                      <span className="tok-code">`Next`</span>{' '}
                      <span className="tok-code">`Express`</span>
                    </div>
                    <div className="tok-blank">&nbsp;</div>
                    <div className="tok-link"><span className="tok-bracket">[</span>Dev.to<span className="tok-bracket">]</span><span className="tok-paren">(</span>https://dev.to/taherankhan<span className="tok-paren">)</span></div>
                    <div className="tok-link"><span className="tok-bracket">[</span>GitHub<span className="tok-bracket">]</span><span className="tok-paren">(</span>https://github.com/taherankhan<span className="tok-paren">)</span></div>
                    <div className="tok-link"><span className="tok-bracket">[</span>LinkedIn<span className="tok-bracket">]</span><span className="tok-paren">(</span>https://linkedin.com/in/taherankhan<span className="tok-paren">)</span><span className="tok-cursor" /></div>
                  </div>
                </div>

                {/* Right: Preview Sheet with Live Theme Adaptation */}
                <div
                  className="lp-mockup-panel lp-mockup-preview"
                  style={{ background: selectedTheme.bg, color: selectedTheme.text }}
                  aria-hidden="true"
                >
                  <div className="lp-preview-sheet-header">
                    <span
                      className="sheet-spec-pill"
                      style={{ color: selectedTheme.text, borderColor: `${selectedTheme.text}33` }}
                    >
                      A4 · 300 DPI Vector PDF
                    </span>
                    <span className="sheet-ready-pill">
                      <i className="bi bi-patch-check-fill me-1" /> Print Ready
                    </span>
                  </div>

                  <div className="lp-preview-sheet-body">
                    <h2 className="lp-preview-doc-title" style={{ color: selectedTheme.text }}>
                      My Professional Resume
                    </h2>
                    <p className="lp-preview-author" style={{ color: selectedTheme.text, opacity: 0.85 }}>
                      <strong>Taheran Khan</strong> · Full Stack Engineer
                    </p>

                    <div className="lp-preview-divider" style={{ background: `${selectedTheme.text}22` }} />

                    <h3 className="lp-preview-subhead" style={{ color: selectedTheme.text }}>
                      Experience
                    </h3>
                    <p className="lp-preview-line" style={{ color: selectedTheme.text, opacity: 0.85 }}>
                      • Full Stack Engineer (2+ years)
                    </p>

                    <h3
                      className="lp-preview-subhead lp-preview-subhead--spaced"
                      style={{ color: selectedTheme.text }}
                    >
                      Skills
                    </h3>
                    <div className="lp-preview-skills-pills">
                      {['Node', 'React', 'Mongo', 'Next', 'Express'].map((skill) => (
                        <span
                          key={skill}
                          className="pv-code"
                          style={{
                            background: `${selectedTheme.text}12`,
                            border: `1px solid ${selectedTheme.text}35`,
                            color: selectedTheme.text,
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="lp-preview-links">
                      {[
                        {
                          label: 'Dev.to',
                          icon: 'M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.83-.26.24-.24.26-.36.26-2.2 0-1.91-.02-1.96-.29-2.18zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-1.52.02v1.7H13.9v1.28h-3.9V8.53h3.66v1.3zM20.21 13c-.02 0-.2.41-.39.92l-.37.93-.37-.93c-.22-.53-.36-.92-.38-.92-.01 0-.17.43-.35.95l-.34.95-.34-.95c-.19-.52-.35-.95-.37-.95-.01 0-.14.33-.28.74l-.26.74h-1.34l.87-2.44 1.13-3.1h1.34l.28.76.28.77.29-.77.29-.76h1.33l1.13 3.1.86 2.44h-1.34l-.28-.74-.27-.74-.35-.95-.36-.95c-.01 0-.17.43-.37.95l-.36.95-.36.95c-.19-.53-.35-.95-.37-.95z',
                        },
                        {
                          label: 'GitHub',
                          icon: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
                        },
                        {
                          label: 'LinkedIn',
                          icon: 'M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z',
                        },
                      ].map((link) => (
                        <span
                          key={link.label}
                          className="pv-link"
                          style={{
                            color: selectedTheme.text,
                            background: `${selectedTheme.text}0d`,
                            borderColor: `${selectedTheme.text}25`,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d={link.icon} />
                          </svg>
                          <span>{link.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div
                    className="lp-preview-sheet-footer"
                    style={{ borderTopColor: `${selectedTheme.text}20`, color: selectedTheme.text }}
                  >
                    <span>Page 1 of 1</span>
                    <span>✓ Zero-Cut Block Pagination</span>
                  </div>
                </div>
              </div>

              {/* Window Status Bar */}
              <div className="lp-mockup-statusbar">
                <div className="lp-status-item">
                  <span className="status-indicator-dot" /> Markdown · UTF-8
                </div>
                <div className="lp-status-item center">
                  <i className="bi bi-palette-fill me-1" /> Theme: <strong>{selectedTheme.name}</strong> ({selectedTheme.desc})
                </div>
                <div className="lp-status-item right">
                  <i className="bi bi-printer-fill me-1" /> Chromium Engine · 100% Vector
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;
