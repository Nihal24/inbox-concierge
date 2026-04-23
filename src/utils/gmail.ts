export interface EmailThread {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  unread: boolean;
}

const LAST_FETCHED_KEY = 'inbox_last_fetched_ts';

export function saveLastFetchedTimestamp(): void {
  localStorage.setItem(LAST_FETCHED_KEY, Math.floor(Date.now() / 1000).toString());
}

export function getLastFetchedTimestamp(): number | null {
  const val = localStorage.getItem(LAST_FETCHED_KEY);
  return val ? parseInt(val) : null;
}

export async function fetchThreads(accessToken: string, afterTimestamp?: number): Promise<EmailThread[]> {
  const q = afterTimestamp ? `in:inbox after:${afterTimestamp}` : 'in:inbox';
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=200&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  const threads: { id: string }[] = listData.threads || [];

  const BATCH = 20;
  const results: EmailThread[] = [];

  for (let i = 0; i < threads.length; i += BATCH) {
    const batch = threads.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map(async (t) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        const messages: any[] = data.messages || [];

        // Search all messages for the headers we need
        const getHeader = (name: string): string => {
          for (const msg of messages) {
            const headers: { name: string; value: string }[] = msg?.payload?.headers || [];
            const val = headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
            if (val) return val;
          }
          return '';
        };

        const unread = messages.some((m) => (m?.labelIds || []).includes('UNREAD'));
        const subject = getHeader('Subject') || data.snippet?.slice(0, 60) || '(no subject)';
        const from = getHeader('From');
        const date = getHeader('Date');

        return {
          id: t.id,
          subject,
          from,
          snippet: data.snippet || '',
          date,
          unread,
        } as EmailThread;
      })
    );
    results.push(...fetched);
  }

  saveLastFetchedTimestamp();
  return results;
}

function decodeBase64url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return decodeURIComponent(escape(decoded));
  } catch {
    return '';
  }
}

function extractBody(payload: any): string {
  if (!payload) return '';

  // Direct body
  if (payload.body?.data) {
    return decodeBase64url(payload.body.data);
  }

  // Multipart — prefer text/plain, fall back to text/html
  if (payload.parts) {
    const plain = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plain?.body?.data) return decodeBase64url(plain.body.data);

    const html = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (html?.body?.data) {
      const raw = decodeBase64url(html.body.data);
      // Strip HTML tags
      return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return '';
}

export async function trashThread(threadId: string, accessToken: string): Promise<void> {
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/trash`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

export async function trashThreads(threadIds: string[], accessToken: string): Promise<void> {
  await Promise.all(threadIds.map((id) => trashThread(id, accessToken)));
}

export async function fetchEmailBody(threadId: string, accessToken: string): Promise<string> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const msg = data.messages?.[data.messages.length - 1]; // latest message in thread
  return extractBody(msg?.payload) || data.snippet || '';
}
