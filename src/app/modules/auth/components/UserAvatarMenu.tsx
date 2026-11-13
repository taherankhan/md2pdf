import React, { FC, useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import './UserAvatarMenu.css';

interface UserAvatarMenuProps {
  onOpenFiles?: () => void;
  className?: string;
}

export const UserAvatarMenu: FC<UserAvatarMenuProps> = ({ onOpenFiles, className = '' }) => {
  const { user, isAuthenticated, openLoginModal, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        className={`btn-auth-signin ${className}`}
        onClick={openLoginModal}
        title="Sign in with Google to save your files in the cloud"
      >
        <svg className="google-icon-svg" viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span className="signin-label">Sign In</span>
      </button>
    );
  }

  const initial = (user.name || user.email || 'U')[0].toUpperCase();

  return (
    <div className={`user-avatar-menu-wrapper ${className}`} ref={menuRef}>
      <button
        type="button"
        className="user-avatar-trigger"
        onClick={() => setDropdownOpen((prev) => !prev)}
        aria-expanded={dropdownOpen}
        title={user.name || user.email}
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name || 'User'}
            className="user-avatar-img"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="user-avatar-fallback">{initial}</div>
        )}
      </button>

      {dropdownOpen && (
        <div className="user-avatar-dropdown animate__animated animate__fadeIn">
          <div className="dropdown-user-header">
            <div className="dropdown-user-name">{user.name || 'MD2PDFX User'}</div>
            <div className="dropdown-user-email">{user.email}</div>
          </div>

          <div className="dropdown-divider"></div>

          {onOpenFiles && (
            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                setDropdownOpen(false);
                onOpenFiles();
              }}
            >
              <i className="bi bi-folder2-open"></i>
              <span>My Files</span>
            </button>
          )}

          <button
            type="button"
            className="dropdown-item dropdown-logout"
            onClick={() => {
              setDropdownOpen(false);
              logout();
            }}
          >
            <i className="bi bi-box-arrow-right"></i>
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};
