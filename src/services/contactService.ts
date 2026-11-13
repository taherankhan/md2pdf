export type ContactMessage = {
  email: string;
  message: string;
};

function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base && typeof base === 'string') {
    return base.replace(/\/+$/, '');
  }
  return '';
}

export async function submitContactMessage(payload: ContactMessage): Promise<void> {
  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email.trim(),
      message: payload.message.trim(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to submit contact message');
  }
}
