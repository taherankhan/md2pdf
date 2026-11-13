/**
 * Share link encoding/decoding and MongoDB API integration.
 * Supports hash-based offline sharing and backend MongoDB Atlas cloud shares.
 */

import LZString from 'lz-string';
import { getAuthHeaders } from './authService';

export interface SharePayload {
  content: string;
  theme?: string;
  /** Document title from the editor header */
  title?: string;
}

export interface FetchShareResult {
  notModified: boolean;
  payload?: SharePayload;
  version?: number;
}

const HASH_PREFIX = 'd=';
const MAX_TITLE_LENGTH = 200;

export function normalizeShareTitle(title: string | undefined): string {
  if (!title) return '';
  return title.trim().slice(0, MAX_TITLE_LENGTH);
}

/**
 * Encode markdown + optional theme into a short hash string (compressed, URI-safe).
 */
export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify({
    content: payload.content,
    theme: payload.theme ?? 'professional',
    title: normalizeShareTitle(payload.title),
  });
  return LZString.compressToEncodedURIComponent(json);
}

/**
 * Decode hash fragment to payload. Returns null if missing or invalid.
 */
export function decodeSharePayload(): SharePayload | null {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const encoded = hash.slice(HASH_PREFIX.length);
  if (!encoded) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json) as SharePayload;
    if (typeof parsed?.content !== 'string') return null;
    return {
      content: parsed.content,
      theme: typeof parsed.theme === 'string' ? parsed.theme : 'professional',
      title: typeof parsed.title === 'string' ? normalizeShareTitle(parsed.title) : '',
    };
  } catch {
    return null;
  }
}

/**
 * Build full share URL for current origin + editor path (works with basename).
 * Always targets /editor so opening the link loads the editor with prefilled data.
 */
export function buildShareUrl(payload: SharePayload): string {
  const encoded = encodeSharePayload(payload);
  if (typeof window === 'undefined') return `#${HASH_PREFIX}${encoded}`;
  const pathname = window.location.pathname;
  const base = window.location.origin + pathname;
  const editorPath = pathname.endsWith('/editor') ? base : base.replace(/\/?$/, '') + '/editor';
  return `${editorPath}#${HASH_PREFIX}${encoded}`;
}

/** Rough safe length for most browsers; beyond this we warn. */
export const SHARE_URL_LENGTH_WARN = 1800;

function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base && typeof base === 'string') {
    return base.replace(/\/+$/, '');
  }
  return '';
}

/**
 * Save payload (content, theme, title) to MongoDB backend. Returns the UUID of the share.
 */
export async function saveSharePayloadToDb(payload: SharePayload, documentId?: string): Promise<string> {
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/shares`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      content: payload.content,
      theme: payload.theme ?? 'professional',
      title: normalizeShareTitle(payload.title),
      documentId: documentId || null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save document: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Fetch payload from MongoDB backend using its ID. Supports conditional version check (304 Not Modified).
 */
export async function fetchSharePayloadFromDb(
  id: string,
  version?: number
): Promise<FetchShareResult | null> {
  const apiBase = getApiBaseUrl();
  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3026';
  const url = new URL(`${apiBase}/api/shares/${encodeURIComponent(id)}`, baseOrigin);

  if (typeof version === 'number' && !isNaN(version)) {
    url.searchParams.set('version', String(version));
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (typeof version === 'number' && !isNaN(version)) {
    headers['If-None-Match'] = `W/"${version}"`;
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (response.status === 304) {
    return { notModified: true };
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load document (${response.status} ${response.statusText})`);
  }

  const data = await response.json();
  return {
    notModified: false,
    payload: {
      content: data.content,
      theme: data.theme,
      title: typeof data.title === 'string' ? data.title : '',
    },
    version: data.version,
  };
}

/**
 * Build full database share URL for current origin + editor path.
 */
export function buildDbShareUrl(id: string): string {
  if (typeof window === 'undefined') return `?share=${id}`;
  const pathname = window.location.pathname;
  const base = window.location.origin + pathname;
  const editorPath = pathname.endsWith('/editor') ? base : base.replace(/\/?$/, '') + '/editor';
  return `${editorPath}?share=${id}`;
}

/**
 * Update an existing payload (content, theme, title) in MongoDB backend.
 */
export async function updateSharePayloadInDb(
  id: string,
  payload: SharePayload
): Promise<{ version: number }> {
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/shares/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      content: payload.content,
      theme: payload.theme ?? 'professional',
      title: normalizeShareTitle(payload.title),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update document: ${response.statusText}`);
  }

  return await response.json();
}
