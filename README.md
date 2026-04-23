# Inbox Concierge

AI-powered email triage. Connects to your Gmail and automatically sorts your last 200 emails into smart buckets using Claude.

**Live app:** https://inbox-concierge-one.vercel.app

---

## What it does

- Fetches your last 200 Gmail threads (metadata only — subject, sender, snippet)
- Classifies them into buckets using Claude Sonnet: **Action Required, Heads Up, Newsletter, Social, Junk**
- Scores urgency on Action Required emails (high / medium / low)
- Generates a 2-sentence AI summary when you open an email
- Remembers sender preferences — move an email to a bucket once, that sender always goes there (skips Claude entirely)
- Supports custom buckets — add any bucket and the whole inbox re-classifies around it
- Incremental refresh — only fetches and classifies new emails since last load, using Haiku for speed
- Trash individual emails or entire buckets
- Analytics panel — bucket breakdown, top senders, noise percentage
- Mobile responsive — single pane navigation on small screens

---

## Architecture

```
Gmail API (metadata) → Claude Sonnet (batches of 25, parallel) → Three-pane UI
                                                                        ↓
                                                              Sender memory (localStorage)
                                                              skips Claude for known senders
```

- **First load** — Claude Sonnet classifies all 200 emails in parallel batches of 25
- **Refresh** — Claude Haiku classifies only new emails, with Sonnet's prior classifications as context
- **No backend** — Claude API called directly from the browser via Anthropic's direct browser access header
- **Session persistence** — Google OAuth token stored in localStorage, silent refresh at 55 minutes

---

## Running locally

**Prerequisites**
- Node.js 16+
- A Google Cloud project with Gmail API enabled and OAuth 2.0 credentials
- An Anthropic API key

**1. Clone the repo**
```bash
git clone https://github.com/Nihal24/inbox-concierge.git
cd inbox-concierge
```

**2. Install dependencies**
```bash
npm install
```

**3. Create a `.env` file in the root**
```
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_ANTHROPIC_API_KEY=your_anthropic_api_key
```

**4. Add `http://localhost:3000` to your Google OAuth authorized origins**

In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client:
- Authorized JavaScript origins: `http://localhost:3000`

**5. Start the app**
```bash
npm start
```

Opens at `http://localhost:3000`

---

## Google OAuth note

The app uses `gmail.modify` scope which allows reading and trashing emails. When signing in you'll see an "unverified app" warning — click **Advanced → Go to Inbox Concierge** to proceed.

This warning exists because `gmail.modify` is a restricted scope requiring a Google security audit for production verification. For a prototype this is expected.

---

## Tech stack

- React + TypeScript
- Gmail REST API
- Claude Sonnet 4.6 (initial classification) / Claude Haiku 4.5 (incremental refresh)
- Recharts (analytics)
- Vercel (deployment)

---

## What I'd improve in production

- **Backend proxy** — move the Anthropic API key server-side (Supabase Edge Function)
- **Server-side cache** — classification cache keyed by user + thread ID with 24hr TTL
- **Real feedback loop** — log every user correction as a training signal, feed back into the prompt as personalized few-shot examples so Claude learns each user's specific preferences over time
- **Deeper Gmail integration** — apply labels and archive directly in Gmail
- **OAuth verification** — complete Google's security review to remove the unverified warning
