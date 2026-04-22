import { EmailThread } from './gmail';

export const DEFAULT_BUCKETS = ['Important', 'Can Wait', 'Newsletter', 'Auto-archive', 'Social'];

export interface ClassifiedEmail extends EmailThread {
  bucket: string;
}

const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY!;

async function classifyBatch(
  emails: EmailThread[],
  buckets: string[]
): Promise<{ id: string; bucket: string }[]> {
  const emailList = emails
    .map((e, i) => `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet.slice(0, 120)}`)
    .join('\n');

  const bucketList = buckets.join(', ');

  const prompt = `You are classifying emails into buckets. Available buckets: ${bucketList}.

Emails:
${emailList}

For each email, reply with ONLY a JSON array of objects like:
[{"index": 1, "bucket": "Important"}, {"index": 2, "bucket": "Newsletter"}, ...]

Rules:
- Every email must be assigned exactly one bucket from the list
- "Important" = needs action, direct personal communication, urgent
- "Can Wait" = informational, low priority, can read later
- "Newsletter" = subscription content, marketing digests, blog posts
- "Auto-archive" = receipts, confirmations, notifications that need no action
- "Social" = social network notifications, event invites
- For custom buckets, use your best judgment based on the name
- Reply with ONLY the JSON array, no other text`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  const text: string = data.content?.[0]?.text?.trim() || '[]';

  try {
    const parsed: { index: number; bucket: string }[] = JSON.parse(text);
    return parsed.map((p) => ({
      id: emails[p.index - 1]?.id || '',
      bucket: buckets.includes(p.bucket) ? p.bucket : buckets[0],
    }));
  } catch {
    // fallback: assign all to first bucket
    return emails.map((e) => ({ id: e.id, bucket: buckets[0] }));
  }
}

export async function classifyEmails(
  emails: EmailThread[],
  buckets: string[],
  onProgress: (pct: number) => void
): Promise<ClassifiedEmail[]> {
  const BATCH_SIZE = 25;
  const batches: EmailThread[][] = [];
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE));
  }

  const bucketMap: Record<string, string> = {};
  let completed = 0;

  // Run all batches in parallel
  await Promise.all(
    batches.map(async (batch) => {
      const results = await classifyBatch(batch, buckets);
      results.forEach((r) => { bucketMap[r.id] = r.bucket; });
      completed += batch.length;
      onProgress(Math.round((completed / emails.length) * 100));
    })
  );

  return emails.map((e) => ({
    ...e,
    bucket: bucketMap[e.id] || buckets[0],
  }));
}
