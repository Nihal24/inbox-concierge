import { EmailThread } from './gmail';

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

Bucket rules:
- "Important" = direct personal emails from real people; bill payments due, appointment reminders, healthcare; bank/financial alerts needing YOUR action (Robinhood margin calls, account verification, security alerts — NOT trade confirmations); emails from employer/boss; anything where YOU personally need to do something.
- "Can Wait" = non-urgent personal emails, low-priority follow-ups, informational emails that don't require immediate action
- "Newsletter" = marketing emails, promotional deals, food/restaurant offers (Papa John's, DoorDash, Uber Eats etc), brand sales, subscription digests, blog content
- "Auto-archive" = order confirmations, shipping/delivery notifications, receipts, password resets, automated system alerts, "your account" emails that need no action; Robinhood trade confirmations, dividend notifications, statements, order filled confirmations
- "Social" = ALL Reddit emails (comments, replies, mentions, trending posts); ALL LinkedIn emails (connections, job alerts, notifications, "don't miss"); ALL Facebook/Instagram/Twitter/TikTok/Snapchat/Discord/dating app notifications; any social network activity whatsoever
- Custom buckets: use best judgment based on name
- Bias STRONGLY toward Social for any Reddit/LinkedIn/social platform email — never put these in Important
- When in doubt between Important and others, use the more specific bucket

Urgency = how urgently THE USER needs to take action (not how urgent the content is):
- "high" = user must respond or act TODAY (e.g. payment overdue, meeting in hours, explicit deadline today)
- "medium" = user should act this week (follow-up needed, upcoming appointment)
- "low" = no action needed from user, or no deadline (community alerts, FYI emails, newsletters = always "low")

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
  const batches: EmailThread[][] = [];
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE));
  }

  const resultMap: Record<string, { bucket: string; urgency: 'high' | 'medium' | 'low' }> = {};
  let completed = 0;

  await Promise.all(
    batches.map(async (batch) => {
      const results = await classifyBatch(batch, buckets);
      results.forEach((r) => { resultMap[r.id] = { bucket: r.bucket, urgency: r.urgency }; });
      completed += batch.length;
      onProgress(Math.round((completed / emails.length) * 100));
    })
  );

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
