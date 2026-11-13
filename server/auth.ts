import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface UserSessionPayload {
  userId: string;
  email: string;
  name: string;
  picture: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserSessionPayload;
    }
  }
}

const DEFAULT_JWT_SECRET = 'md2pdfx-auth-session-secret-change-in-prod-2026';

function getJwtSecret(): string {
  return process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Creates a signed JWT string using HMAC-SHA256 (expires in 30 days)
 */
export function createSessionToken(payload: UserSessionPayload): string {
  const secret = getJwtSecret();
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 30 * 24 * 60 * 60; // 30 days
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: now,
      exp,
    })
  );

  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${header}.${body}.${signature}`;
}

/**
 * Verifies and decodes a signed JWT string
 */
export function verifySessionToken(token: string): UserSessionPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, bodyB64, signatureB64] = parts;
    const secret = getJwtSecret();

    const expectedSig = createHmac('sha256', secret)
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const expectedBuffer = Buffer.from(expectedSig);
    const actualBuffer = Buffer.from(signatureB64);

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(bodyB64));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    if (!payload.userId || !payload.email) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name || '',
      picture: payload.picture || '',
    };
  } catch {
    return null;
  }
}

/**
 * Verifies a Google ID token by querying Google's tokeninfo API.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  try {
    if (!idToken || typeof idToken !== 'string') return null;

    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );

    if (!res.ok) {
      console.warn('Google token verification failed with status:', res.status);
      return null;
    }

    const data: any = await res.json();
    if (!data.sub || !data.email) {
      return null;
    }

    // Optional audience check if GOOGLE_CLIENT_ID is configured
    const configuredAud = process.env.GOOGLE_CLIENT_ID;
    if (configuredAud && data.aud && data.aud !== configuredAud) {
      console.warn(`Token audience mismatch: got ${data.aud}, expected ${configuredAud}`);
      return null;
    }

    return {
      googleId: data.sub,
      email: data.email.toLowerCase(),
      name: data.name || data.email.split('@')[0],
      picture: data.picture || '',
    };
  } catch (err) {
    console.error('Error verifying Google ID token:', err);
    return null;
  }
}

/**
 * Extracts session token from Authorization header or cookie
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.header('authorization') || req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = req.header('cookie') || req.headers['cookie'];
  if (cookieHeader && typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('auth_token=')) {
        return decodeURIComponent(cookie.slice('auth_token='.length));
      }
    }
  }

  return null;
}

/**
 * Middleware: Requires an authenticated user session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = verifySessionToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = user;
  next();
}

/**
 * Middleware: Optionally attaches authenticated user session if present
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const user = verifySessionToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}
