export interface EmailThread {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  unread: boolean;
}

export async function fetchThreads(accessToken: string): Promise<EmailThread[]> {
  // Fetch last 200 thread IDs
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=200&q=in:inbox',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  const threads: { id: string }[] = listData.threads || [];

  // Fetch thread details in parallel batches of 20
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
        const msg = data.messages?.[0];
        const headers: { name: string; value: string }[] = msg?.payload?.headers || [];
        const get = (name: string) => headers.find((h) => h.name === name)?.value || '';
        const unread: boolean = (msg?.labelIds || []).includes('UNREAD');
        return {
          id: t.id,
          subject: get('Subject') || '(no subject)',
          from: get('From'),
          snippet: data.snippet || '',
          date: get('Date'),
          unread,
        } as EmailThread;
      })
    );
    results.push(...fetched);
  }

  return results;
}
