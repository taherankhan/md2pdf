export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthResponse {
  success: boolean;
  user: UserProfile;
  token: string;
}

const AUTH_STORAGE_KEY = 'md2pdfx_auth_user';
const TOKEN_STORAGE_KEY = 'md2pdfx_auth_token';

function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }
  return '';
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(user: UserProfile, token: string): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (e) {
    console.warn('Failed to store session in localStorage:', e);
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear stored session:', e);
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Authenticates with Google ID token credential
 */
export async function loginWithGoogle(credential: string): Promise<UserProfile> {
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ credential }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to authenticate with Google');
  }

  const data: AuthResponse = await response.json();
  setStoredSession(data.user, data.token);
  return data.user;
}

/**
 * Validates current session with the server
 */
export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const apiBase = getApiBaseUrl();
  const token = getStoredToken();

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`${apiBase}/api/auth/me`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      clearStoredSession();
      return null;
    }

    if (!response.ok) {
      return getStoredUser();
    }

    const data = await response.json();
    if (data.user) {
      if (token) setStoredSession(data.user, token);
      return data.user;
    }
    return null;
  } catch (e) {
    // If offline or network issue, fallback to cached user
    return getStoredUser();
  }
}

/**
 * Logs out and clears session
 */
export async function logoutUser(): Promise<void> {
  const apiBase = getApiBaseUrl();
  try {
    await fetch(`${apiBase}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (e) {
    console.warn('Logout request failed:', e);
  } finally {
    clearStoredSession();
  }
}
