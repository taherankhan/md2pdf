import { getAuthHeaders } from './authService';

export interface DocumentSummary {
  _id: string;
  userId: string;
  title: string;
  theme: string;
  shareId?: string | null;
  isPublic: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarkdownDocument extends DocumentSummary {
  content: string;
}

function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }
  return '';
}

/**
 * Fetch all documents owned by current authenticated user
 */
export async function fetchUserDocuments(): Promise<DocumentSummary[]> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/documents`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch user documents');
  }

  const data = await res.json();
  return data.documents || [];
}

/**
 * Create a new document in the user library
 */
export async function createDocument(payload: {
  title?: string;
  content?: string;
  theme?: string;
}): Promise<MarkdownDocument> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/documents`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create document');
  }

  return await res.json();
}

/**
 * Fetch a single document by ID
 */
export async function fetchDocumentById(id: string): Promise<MarkdownDocument> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/documents/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch document');
  }

  return await res.json();
}

/**
 * Update an existing document (and sync to public share if published)
 */
export async function updateDocument(
  id: string,
  payload: { title?: string; content?: string; theme?: string }
): Promise<void> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/documents/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update document');
  }
}

/**
 * Delete a document from library
 */
export async function deleteDocument(id: string): Promise<void> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete document');
  }
}

/**
 * Generate or retrieve the public share ID for a document
 */
export async function shareDocument(id: string): Promise<{ shareId: string }> {
  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/documents/${encodeURIComponent(id)}/share`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate share link');
  }

  return await res.json();
}
