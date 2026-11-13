import React, { FC, useEffect, useRef } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import './GoogleLoginModal.css';

declare global {
  interface Window {
    google?: any;
  }
}

export const GoogleLoginModal: FC = () => {
  const { isLoginModalOpen, closeLoginModal, loginWithCredential, googleClientId, isLoading } =
    useAuth();
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoginModalOpen) return;

    if (!googleClientId) {
      return;
    }

    const interval = setInterval(() => {
      if (window.google?.accounts?.id && googleBtnContainerRef.current) {
        clearInterval(interval);
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response: any) => {
              if (response?.credential) {
                loginWithCredential(response.credential);
              }
            },
          });

          googleBtnContainerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'filled_blue',
            size: 'large',
            shape: 'pill',
            width: 280,
            text: 'continue_with',
          });
        } catch (e) {
          console.error('Failed to initialize Google button:', e);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isLoginModalOpen, googleClientId, loginWithCredential]);

  if (!isLoginModalOpen) return null;

  return (
    <div className="login-modal-overlay" onClick={closeLoginModal}>
      <div
        className="login-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <button
          className="login-modal-close"
          onClick={closeLoginModal}
          type="button"
          aria-label="Close"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        <div className="login-modal-header">
          <div className="login-modal-icon">
            <i className="bi bi-person-circle"></i>
          </div>
          <h2 id="login-modal-title" className="login-modal-title">
            Sign In with Google
          </h2>
          <p className="login-modal-desc">
            Save markdown files to your personal cloud library, access them across devices, and manage shared links.
          </p>
        </div>

        <div className="login-modal-body">
          {googleClientId ? (
            <div className="google-btn-wrapper">
              <div ref={googleBtnContainerRef} className="google-btn-slot"></div>
              {isLoading && <p className="login-loading-text">Signing in...</p>}
            </div>
          ) : (
            <div className="client-id-missing-box">
              <div className="missing-icon">
                <i className="bi bi-gear-fill"></i>
              </div>
              <h4>Google Client ID Setup</h4>
              <p>
                Add <code>GOOGLE_CLIENT_ID</code> to your <code>.env</code> file from the Google Cloud Console to enable Google Sign-In.
              </p>
            </div>
          )}
        </div>

        <div className="login-modal-footer">
          <span className="guest-note">
            <i className="bi bi-shield-check"></i> Guests can still write and export without signing in.
          </span>
        </div>
      </div>
    </div>
  );
};
