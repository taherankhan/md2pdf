import { FC } from 'react';
import { useNavigate } from 'react-router-dom';

export const CloudSyncSection: FC = () => {
  const navigate = useNavigate();

  return (
    <section id="lp-cloud-sync" className="lp-section lp-cloud-section">
      <div className="lp-section-inner">
        {/* Header */}
        <div className="lp-section-header text-center mb-5">
          <span className="lp-section-label lp-section-label--center">CLOUD SYNC & LIBRARY</span>
          <h2 className="lp-section-title">
            Sign In with Google. Save Unlimited Drafts in the Cloud.
          </h2>
          <p className="lp-section-desc mx-auto">
            Switch between devices without losing a keystroke. Connect your Google account in one click to access your private cloud document vault backed by MongoDB Atlas.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="lp-cloud-showcase-grid">
          {/* Left Column: Interactive Cloud Vault Visual Mockup */}
          <div className="lp-cloud-vault-card">
            <div className="vault-topbar">
              <div className="vault-user-chip">
                <span className="user-avatar-glow">T</span>
                <div className="user-meta">
                  <span className="user-name">Taheran Khan</span>
                  <span className="user-status"><span className="status-dot green" /> Cloud Connected</span>
                </div>
              </div>
              <span className="vault-badge"><i className="bi bi-shield-check" /> MongoDB Atlas Encrypted</span>
            </div>

            <div className="vault-docs-list">
              <div className="vault-doc-item active">
                <div className="doc-icon"><i className="bi bi-file-earmark-richtext-fill text-primary" /></div>
                <div className="doc-info">
                  <span className="doc-title">CloudScale Distributed Architecture Handbook</span>
                  <div className="doc-tags">
                    <span className="tag-theme">Dark Theme</span>
                    <span className="tag-size">A4</span>
                    <span className="tag-time">Saved 2m ago</span>
                  </div>
                </div>
                <span className="doc-sync-pill"><i className="bi bi-cloud-check-fill" /> Synced</span>
              </div>

              <div className="vault-doc-item">
                <div className="doc-icon"><i className="bi bi-file-earmark-code-fill text-cyan" /></div>
                <div className="doc-info">
                  <span className="doc-title">Payments API Gateway & Microservices Specification</span>
                  <div className="doc-tags">
                    <span className="tag-theme">Professional</span>
                    <span className="tag-size">Letter</span>
                    <span className="tag-time">Updated yesterday</span>
                  </div>
                </div>
                <span className="doc-share-btn"><i className="bi bi-link-45deg" /> /s/8f92a1b</span>
              </div>

              <div className="vault-doc-item">
                <div className="doc-icon"><i className="bi bi-file-earmark-person-fill text-purple" /></div>
                <div className="doc-info">
                  <span className="doc-title">Senior Software Architect - Executive Resume</span>
                  <div className="doc-tags">
                    <span className="tag-theme">Resume</span>
                    <span className="tag-size">A4</span>
                    <span className="tag-time">3 days ago</span>
                  </div>
                </div>
                <span className="doc-sync-pill"><i className="bi bi-cloud-check-fill" /> Synced</span>
              </div>
            </div>

            <div className="vault-footer-bar">
              <div className="vault-metric">
                <i className="bi bi-database-check text-success" />
                <span>304 Conditional Sync (Ultra Low Latency)</span>
              </div>
              <button
                type="button"
                className="vault-action-btn"
                onClick={() => navigate('/editor')}
              >
                <span>Open Cloud Library</span>
                <i className="bi bi-arrow-right" />
              </button>
            </div>
          </div>

          {/* Right Column: 4 Feature Grid Cards */}
          <div className="lp-cloud-features-grid">
            <div className="cloud-feat-card">
              <div className="cloud-feat-icon feat-google">
                <i className="bi bi-google" />
              </div>
              <h4 className="cloud-feat-title">1-Click Google OAuth</h4>
              <p className="cloud-feat-desc">
                No tedious passwords or email verification links. Sign in with your existing Google credentials in under 2 seconds.
              </p>
            </div>

            <div className="cloud-feat-card">
              <div className="cloud-feat-icon feat-db">
                <i className="bi bi-hdd-network-fill" />
              </div>
              <h4 className="cloud-feat-title">MongoDB Atlas Vault</h4>
              <p className="cloud-feat-desc">
                Enterprise-grade cloud storage automatically saves your Markdown content, active typography theme, and custom margin setup.
              </p>
            </div>

            <div className="cloud-feat-card">
              <div className="cloud-feat-icon feat-share">
                <i className="bi bi-share-fill" />
              </div>
              <h4 className="cloud-feat-title">Live Shareable Links</h4>
              <p className="cloud-feat-desc">
                Generate clean, shareable read-only links with custom titles. When you update your document, shared links sync automatically.
              </p>
            </div>

            <div className="cloud-feat-card">
              <div className="cloud-feat-icon feat-offline">
                <i className="bi bi-wifi-off" />
              </div>
              <h4 className="cloud-feat-title">Offline-First Resilience</h4>
              <p className="cloud-feat-desc">
                Losing internet connection never halts your flow. LocalStorage captures every keystroke and syncs with the cloud once reconnected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CloudSyncSection;
