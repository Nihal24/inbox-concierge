import React, { useEffect, useRef, useState } from 'react';
import InboxView from './components/InboxView';
import ErrorBoundary from './components/ErrorBoundary';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID!;
const SCOPES = 'https://www.googleapis.com/auth/gmail.modify email profile';

const TOKEN_KEY = 'inbox_access_token';
const TOKEN_EXPIRY_KEY = 'inbox_token_expiry';
const USER_EMAIL_KEY = 'inbox_user_email';

declare global {
  interface Window { google: any; tokenClient: any; }
}

const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [gsiReady, setGsiReady] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEmailRef = useRef(userEmail);
  userEmailRef.current = userEmail;

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => setGsiReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!gsiReady) return;

    window.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp: any) => {
        if (resp.error) return; // silent refresh failed — user stays on login screen

        const expiry = Date.now() + 55 * 60 * 1000;
        localStorage.setItem(TOKEN_KEY, resp.access_token);
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
        setAccessToken(resp.access_token);

        // Fetch email only on first sign-in, not on silent refresh
        if (!userEmailRef.current) {
          const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          }).then((r) => r.json());
          const email = info.email || '';
          setUserEmail(email);
          localStorage.setItem(USER_EMAIL_KEY, email);
        }

        // Schedule next silent refresh
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          window.tokenClient.requestAccessToken({ prompt: '' });
        }, 55 * 60 * 1000);
      },
    });

    // Restore session from localStorage
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    const storedEmail = localStorage.getItem(USER_EMAIL_KEY);

    if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry)) {
      // Token still valid — restore immediately, no login prompt
      setAccessToken(storedToken);
      if (storedEmail) setUserEmail(storedEmail);
      userEmailRef.current = storedEmail || '';
      const remaining = parseInt(storedExpiry) - Date.now();
      refreshTimerRef.current = setTimeout(() => {
        window.tokenClient.requestAccessToken({ prompt: '' });
      }, remaining);
    } else {
      // Try silent refresh (works if user's Google session is still active)
      window.tokenClient.requestAccessToken({ prompt: '' });
    }
  }, [gsiReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignIn = () => {
    if (window.tokenClient) window.tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleSignOut = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (accessToken) window.google.accounts.oauth2.revoke(accessToken);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    setAccessToken(null);
    setUserEmail('');
  };

  if (accessToken) {
    return (
      <ErrorBoundary>
        <InboxView accessToken={accessToken} userEmail={userEmail} onSignOut={handleSignOut} />
      </ErrorBoundary>
    );
  }

  return (
    <div style={styles.loginPage}>
      <div style={styles.loginCard}>
        <div style={styles.loginIcon}>📬</div>
        <h1 style={styles.loginTitle}>Inbox Concierge</h1>
        <p style={styles.loginSubtitle}>
          AI-powered email triage. Your last 200 emails, instantly sorted by what matters.
        </p>
        <button onClick={handleSignIn} style={styles.googleBtn} disabled={!gsiReady}>
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 10, flexShrink: 0 }}>
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.996 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
          </svg>
          Sign in with Google
        </button>
        <p style={styles.disclaimer}>Read-only Gmail access. Your emails never leave your browser.</p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  loginPage: {
    minHeight: '100vh', backgroundColor: '#0d0f14',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  loginCard: {
    backgroundColor: '#111318', border: '1px solid #2a2d35',
    borderRadius: 20, padding: '48px 40px',
    textAlign: 'center', maxWidth: 400, width: '100%', margin: '0 20px',
  },
  loginIcon: { fontSize: 52, marginBottom: 16 },
  loginTitle: { fontSize: 28, fontWeight: 800, color: '#f0f0f0', margin: '0 0 12px', letterSpacing: -0.5 },
  loginSubtitle: { fontSize: 15, color: '#666', margin: '0 0 32px', lineHeight: 1.5 },
  googleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', padding: '13px 20px',
    backgroundColor: '#fff', border: 'none', borderRadius: 10,
    fontSize: 15, fontWeight: 600, color: '#1a1a1a', cursor: 'pointer', marginBottom: 16,
  },
  disclaimer: { fontSize: 12, color: '#444', margin: 0 },
};

export default App;
