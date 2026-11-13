import React, { createContext, useContext, useEffect, useState, FC, ReactNode, useCallback } from 'react';
import {
  UserProfile,
  getStoredUser,
  fetchCurrentUser,
  loginWithGoogle,
  logoutUser,
} from '../services/authService';
import { toast } from 'react-toastify';

export interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoginModalOpen: boolean;
  googleClientId: string;
  loginWithCredential: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.GOOGLE_CLIENT_ID ||
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '';

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Hydrate user on mount
  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((remoteUser) => {
        if (mounted) {
          setUser(remoteUser);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const loginWithCredential = useCallback(async (credential: string) => {
    try {
      setIsLoading(true);
      const profile = await loginWithGoogle(credential);
      setUser(profile);
      setIsLoginModalOpen(false);
      toast.success(`Welcome back, ${profile.name || profile.email}!`);
    } catch (err: any) {
      console.error('Google login error:', err);
      toast.error(err.message || 'Failed to sign in with Google');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
      setUser(null);
      toast.info('Signed out successfully.');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        isLoginModalOpen,
        googleClientId: GOOGLE_CLIENT_ID,
        loginWithCredential,
        logout,
        openLoginModal,
        closeLoginModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
