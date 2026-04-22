import { EmailThread } from './gmail';
import { getSenderMemory, extractEmailAddress } from './senderMemory';

export const DEFAULT_BUCKETS = ['Important', 'Can Wait', 'Newsletter', 'Auto-archive', 'Social'];

export interface ClassifiedEmail extends EmailThread {
  bucket: string;
  urgency?: 'high' | 'medium' | 'low';
}

export interface InboxSummary {
  headline: string;
  insight: string;
  noisePercent: number;
}

const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY!;

async function callClaude(prompt: string, maxTokens = 1024): Promise<string> {
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
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  let text: string = data.content?.[0]?.text?.trim() || '';
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return text;
}

async function classifyBatch(
  emails: EmailThread[],
  buckets: string[]
): Promise<{ id: string; bucket: string; urgency: 'high' | 'medium' | 'low' }[]> {
  const emailList = emails
    .map((e, i) => `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet.slice(0, 120)}`)
    .join('\n');

  const prompt = `You are classifying emails. Available buckets: ${buckets.join(', ')}.

Emails:
${emailList}

Reply ONLY with a JSON array:
[{"index": 1, "bucket": "Important", "urgency": "high"}, ...]

IMPORTANT RULE: "Important" is ONLY for emails where a real human personally addressed the user and expects a response or action. If an email could have been sent to thousands of people automatically, it is NOT Important.

Bucket rules:
- "Important" = a real person wrote this specifically to you; personal bills/appointments requiring action; your employer or a colleague; someone waiting on your response. STRICT: if it's automated, a notification, a digest, a tip, an alert, or marketing — it is NOT Important regardless of how urgent it sounds.
- "Can Wait" = non-urgent personal emails; informational content you may want to read; job application follow-ups; community posts (neighborhood/HOA alerts like "motorcycle accident" or "safety tips" — these are FYI, not action items)
- "Newsletter" = any marketing email; event registrations; promotional offers; job listing digests (Idealist, Indeed, Glassdoor alerts); course/workshop promotions; health/wellness tips; brand content; anything with "unsubscribe" at the bottom
- "Auto-archive" = order/payment confirmations; shipping updates; receipts; password resets; "your account" automated emails; ALL Robinhood emails (trade fills, safety tips, account alerts, statements, promotions — all of it); bank transaction alerts that need no action; automated app notifications
- "Social" = ALL Reddit, LinkedIn, Facebook, Instagram, Twitter/X, TikTok, Snapchat, Discord, dating apps; social network activity of any kind
- Custom buckets: use best judgment based on the name
- When in doubt, pick anything EXCEPT Important

Urgency = only how urgently THE USER personally needs to act (never the urgency of world events):
- "high" = user must act TODAY — overdue payment, same-day deadline, urgent personal request
- "medium" = user should act this week — upcoming appointment, follow-up needed
- "low" = everything else, including all automated emails, community alerts, newsletters

Reply with ONLY the JSON array, no other text.`;

  const text = await callClaude(prompt);
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  const cleaned = arrayMatch ? arrayMatch[0] : text;

  try {
    const parsed: { index: number; bucket: string; urgency?: string }[] = JSON.parse(cleaned);
    return parsed.map((p) => ({
      id: emails[p.index - 1]?.id || '',
      bucket: buckets.includes(p.bucket) ? p.bucket : buckets[1],
      urgency: (['high', 'medium', 'low'].includes(p.urgency || '') ? p.urgency : 'low') as 'high' | 'medium' | 'low',
    }));
  } catch (err) {
    console.error('Classification parse error:', err, 'Raw:', cleaned);
    return emails.map((e) => ({ id: e.id, bucket: buckets[1], urgency: 'low' as const }));
  }
}

export async function classifyEmails(
  emails: EmailThread[],
  buckets: string[],
  onProgress: (pct: number) => void
): Promise<ClassifiedEmail[]> {
  const BATCH_SIZE = 25;
  const memory = getSenderMemory();

  // Pre-assign emails from known senders — no Claude call needed
  const preAssigned: Record<string, { bucket: string; urgency: 'high' | 'medium' | 'low' }> = {};
  const needsClassification: EmailThread[] = [];

  for (const email of emails) {
    const senderEmail = extractEmailAddress(email.from);
    if (memory[senderEmail] && buckets.includes(memory[senderEmail])) {
      preAssigned[email.id] = { bucket: memory[senderEmail], urgency: 'low' };
    } else {
      needsClassification.push(email);
    }
  }

  const resultMap: Record<string, { bucket: string; urgency: 'high' | 'medium' | 'low' }> = {
    ...preAssigned,
  };

  let completed = Object.keys(preAssigned).length;
  onProgress(Math.round((completed / emails.length) * 100));

  if (needsClassification.length > 0) {
    const batches: EmailThread[][] = [];
    for (let i = 0; i < needsClassification.length; i += BATCH_SIZE) {
      batches.push(needsClassification.slice(i, i + BATCH_SIZE));
    }

    await Promise.all(
      batches.map(async (batch) => {
        const results = await classifyBatch(batch, buckets);
        results.forEach((r) => { resultMap[r.id] = { bucket: r.bucket, urgency: r.urgency }; });
        completed += batch.length;
        onProgress(Math.round((completed / emails.length) * 100));
      })
    );
  }

  return emails.map((e) => ({
    ...e,
    bucket: resultMap[e.id]?.bucket || buckets[1],
    urgency: resultMap[e.id]?.urgency || 'low',
  }));
}

export async function generateInboxSummary(emails: ClassifiedEmail[]): Promise<InboxSummary> {
  const bucketCounts: Record<string, number> = {};
  emails.forEach((e) => { bucketCounts[e.bucket] = (bucketCounts[e.bucket] || 0) + 1; });

  const important = emails.filter((e) => e.bucket === 'Important');
  const highUrgency = important.filter((e) => e.urgency === 'high');
  const noiseCount = (bucketCounts['Newsletter'] || 0) + (bucketCounts['Auto-archive'] || 0) + (bucketCounts['Social'] || 0);
  const noisePercent = Math.round((noiseCount / emails.length) * 100);

  const importantSubjects = important.slice(0, 5).map((e) => e.subject).join(', ');

  const prompt = `A user's inbox has been sorted by AI. Give them a 1-sentence personalized insight.

Stats:
- Total: ${emails.length} emails
- Important: ${important.length} (${highUrgency.length} high urgency)
- Noise (newsletters/social/auto-archive): ${noisePercent}%
- Important subjects: ${importantSubjects || 'none'}

Write ONE concise, specific, helpful sentence (not generic). Be direct. No fluff. Examples of good tone:
"You have ${highUrgency.length} emails that need attention today."
"${noisePercent}% of your inbox is noise — mostly newsletters and promotions."

Reply with ONLY the sentence.`;

  const insight = await callClaude(prompt, 100);

  const importantCount = important.length;
  const headline = highUrgency.length > 0
    ? `${highUrgency.length} urgent · ${importantCount} important`
    : importantCount > 0
    ? `${importantCount} important emails`
    : 'Inbox looks clear';

  return { headline, insight: insight || `${noisePercent}% of your inbox is noise.`, noisePercent };
}

export async function summarizeEmail(subject: string, from: string, body: string): Promise<string> {
  const prompt = `Summarize this email in 2 sentences. Be specific and direct — what does it say and what (if anything) is needed?

From: ${from}
Subject: ${subject}
Body: ${body.slice(0, 2000)}

Reply with ONLY the 2-sentence summary.`;

  return callClaude(prompt, 150);
}
