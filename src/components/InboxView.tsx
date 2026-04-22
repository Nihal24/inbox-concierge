import React, { useEffect, useState, useCallback, useRef } from 'react';
import { fetchThreads, EmailThread, getLastFetchedTimestamp } from '../utils/gmail';
import { classifyEmails, ClassifiedEmail, DEFAULT_BUCKETS, generateInboxSummary, InboxSummary } from '../utils/classify';
import { getMemoryCount } from '../utils/senderMemory';
import BucketColumn from './BucketColumn';
import EmailDetailModal from './EmailDetailModal';
import AnalyticsPanel from './AnalyticsPanel';

interface Props {
  accessToken: string;
  userEmail: string;
  onSignOut: () => void;
}

const BUCKET_COLORS: Record<string, string> = {
  'Important': '#ef4444',
  'Can Wait': '#3b82f6',
  'Newsletter': '#8b5cf6',
  'Auto-archive': '#6b7280',
  'Social': '#10b981',
};
const EXTRA_COLORS = ['#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

function getBucketColor(bucket: string, allBuckets: string[]): string {
  if (BUCKET_COLORS[bucket]) return BUCKET_COLORS[bucket];
  const idx = allBuckets.indexOf(bucket) - DEFAULT_BUCKETS.length;
  return EXTRA_COLORS[idx % EXTRA_COLORS.length];
}

const InboxView: React.FC<Props> = ({ accessToken, userEmail, onSignOut }) => {
  const [emails, setEmails] = useState<ClassifiedEmail[]>([]);
  const [buckets, setBuckets] = useState<string[]>(DEFAULT_BUCKETS);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Fetching emails...');
  const [progress, setProgress] = useState(0);
  const [rawThreads, setRawThreads] = useState<EmailThread[]>([]);
  const [newBucket, setNewBucket] = useState('');
  const [reclassifying, setReclassifying] = useState(false);
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<ClassifiedEmail | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newEmailCount, setNewEmailCount] = useState<number | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);

  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;

  const bucketColorMap = Object.fromEntries(buckets.map((b) => [b, getBucketColor(b, buckets)]));

  const runClassification = useCallback(async (threads: EmailThread[], currentBuckets: string[]) => {
    setReclassifying(true);
    setProgress(0);
    setSummary(null);
    const classified = await classifyEmails(threads, currentBuckets, (pct) => setProgress(pct));
    setEmails(classified);
    setReclassifying(false);
    const s = await generateInboxSummary(classified);
    setSummary(s);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadingMsg('Fetching your emails...');
      setProgress(0);
      const threads = await fetchThreads(accessToken);
      setRawThreads(threads);
      setProgress(20);
      setLoadingMsg(`Classifying ${threads.length} emails with AI...`);
      const classified = await classifyEmails(threads, DEFAULT_BUCKETS, (pct) =>
        setProgress(20 + Math.round(pct * 0.75))
      );
      setEmails(classified);
      setLoading(false);
      setMemoryCount(getMemoryCount());
      const s = await generateInboxSummary(classified);
      setSummary(s);
    })();
  }, [accessToken]);

  const handleRefresh = async () => {
    const lastTs = getLastFetchedTimestamp();
    if (!lastTs) return;
    setRefreshing(true);
    setNewEmailCount(null);
    try {
      const newThreads = await fetchThreads(accessToken, lastTs);
      const existingIds = new Set(rawThreads.map((t) => t.id));
      const brandNew = newThreads.filter((t) => !existingIds.has(t.id));
      if (brandNew.length === 0) {
        setNewEmailCount(0);
        setTimeout(() => setNewEmailCount(null), 3000);
        return;
      }
      const classified = await classifyEmails(brandNew, bucketsRef.current, () => {});
      setEmails((prev) => [...classified, ...prev]);
      setRawThreads((prev) => [...brandNew, ...prev]);
      setNewEmailCount(brandNew.length);
      setTimeout(() => setNewEmailCount(null), 4000);
    } finally {
      setRefreshing(false);
    }
  };

  const addBucket = async () => {
    const name = newBucket.trim();
    if (!name || buckets.includes(name)) return;
    const updated = [...buckets, name];
    setBuckets(updated);
    setNewBucket('');
    await runClassification(rawThreads, updated);
  };

  const removeBucket = async (bucket: string) => {
    if (DEFAULT_BUCKETS.includes(bucket)) return;
    const updated = buckets.filter((b) => b !== bucket);
    setBuckets(updated);
    await runClassification(rawThreads, updated);
  };

  const handleBulkArchive = (bucket: string) => {
    setEmails((prev) => prev.filter((e) => e.bucket !== bucket));
  };

  const handleMove = (emailId: string, newBucket: string) => {
    setEmails((prev) => prev.map((e) => e.id === emailId ? { ...e, bucket: newBucket } : e));
    setMemoryCount(getMemoryCount() + 1);
    // Update selected email bucket label live
    setSelectedEmail((prev) => prev && prev.id === emailId ? { ...prev, bucket: newBucket } : prev);
  };

  const emailsByBucket = buckets.reduce<Record<string, ClassifiedEmail[]>>((acc, b) => {
    acc[b] = emails.filter((e) => e.bucket === b);
    return acc;
  }, {});

  const isLoading = loading || reclassifying;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>📬</div>
          <div>
            <div style={styles.appName}>Inbox Concierge</div>
            <div style={styles.userEmail}>{userEmail}</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          {!loading && memoryCount > 0 && (
            <div style={styles.memoryBadge}>
              🧠 {memoryCount} learned
            </div>
          )}
          {!loading && emails.length > 0 && (
            <button onClick={() => setShowAnalytics(true)} style={styles.analyticsBtn}>
              📊 Analytics
            </button>
          )}
          {!loading && (
            <button onClick={handleRefresh} style={styles.refreshBtn} disabled={refreshing}>
              {refreshing ? '...' : '↻ Refresh'}
            </button>
          )}
          {!loading && <span style={styles.totalCount}>{emails.length} emails</span>}
          <button onClick={onSignOut} style={styles.signOutBtn}>Sign out</button>
        </div>
      </div>

      {/* New email toast */}
      {newEmailCount !== null && (
        <div style={{ ...styles.toast, backgroundColor: newEmailCount > 0 ? '#1d4ed8' : '#16181f' }}>
          {newEmailCount > 0 ? `✓ ${newEmailCount} new email${newEmailCount > 1 ? 's' : ''} added` : 'No new emails'}
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingCard}>
            <div style={styles.loadingMsg}>{loadingMsg}</div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
            <div style={styles.progressPct}>{progress}%</div>
          </div>
        </div>
      )}

      {/* Summary card */}
      {!loading && summary && (
        <div style={styles.summaryCard}>
          <div style={styles.summaryLeft}>
            <span style={styles.aiStar}>✦</span>
            <div>
              <div style={styles.summaryHeadline}>{summary.headline}</div>
              <div style={styles.summaryInsight}>{summary.insight}</div>
            </div>
          </div>
          <div style={styles.noisePill}>
            <span style={styles.noiseNum}>{summary.noisePercent}%</span>
            <span style={styles.noiseLabel}>noise</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!loading && (
        <div style={styles.toolbar}>
          <div style={styles.bucketPills}>
            {buckets.map((b) => (
              <div key={b} style={{ ...styles.bucketPill, borderColor: getBucketColor(b, buckets) }}>
                <span style={{ ...styles.pillDot, backgroundColor: getBucketColor(b, buckets) }} />
                <span style={styles.pillLabel}>{b}</span>
                <span style={styles.pillCount}>{emailsByBucket[b]?.length ?? 0}</span>
                {!DEFAULT_BUCKETS.includes(b) && (
                  <button onClick={() => removeBucket(b)} style={styles.removePill}>×</button>
                )}
              </div>
            ))}
          </div>
          <div style={styles.addBucket}>
            <input
              style={styles.bucketInput}
              placeholder="Add bucket..."
              value={newBucket}
              onChange={(e) => setNewBucket(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBucket()}
            />
            <button onClick={addBucket} style={styles.addBtn} disabled={!newBucket.trim()}>+ Add</button>
          </div>
        </div>
      )}

      {/* Columns */}
      {!loading && (
        <div style={styles.columns}>
          {buckets.map((b) => (
            <BucketColumn
              key={b}
              bucket={b}
              emails={emailsByBucket[b] || []}
              color={getBucketColor(b, buckets)}
              onEmailClick={setSelectedEmail}
              onBulkArchive={() => handleBulkArchive(b)}
            />
          ))}
        </div>
      )}

      {/* Email detail modal */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          accessToken={accessToken}
          bucketColor={bucketColorMap[selectedEmail.bucket] || '#888'}
          buckets={buckets}
          bucketColors={bucketColorMap}
          onClose={() => setSelectedEmail(null)}
          onMove={handleMove}
        />
      )}

      {/* Analytics panel */}
      {showAnalytics && (
        <AnalyticsPanel
          emails={emails}
          bucketColors={bucketColorMap}
          onClose={() => setShowAnalytics(false)}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh', backgroundColor: '#0d0f14', color: '#f0f0f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px', borderBottom: '1px solid #1e2028',
    backgroundColor: '#0d0f14', flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logo: { fontSize: 28 },
  appName: { fontSize: 18, fontWeight: 800, color: '#f0f0f0', letterSpacing: -0.5 },
  userEmail: { fontSize: 12, color: '#555', marginTop: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  memoryBadge: {
    fontSize: 12, color: '#888', backgroundColor: '#16181f',
    border: '1px solid #2a2d35', padding: '4px 10px', borderRadius: 20,
  },
  analyticsBtn: {
    backgroundColor: '#16181f', border: '1px solid #2a2d35',
    color: '#c0c0c0', padding: '6px 14px', borderRadius: 8,
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  refreshBtn: {
    backgroundColor: 'transparent', border: '1px solid #2a2d35',
    color: '#888', padding: '6px 14px', borderRadius: 8,
    cursor: 'pointer', fontSize: 13,
  },
  totalCount: { fontSize: 13, color: '#555' },
  signOutBtn: {
    backgroundColor: 'transparent', border: '1px solid #2a2d35',
    color: '#888', padding: '6px 14px', borderRadius: 8,
    cursor: 'pointer', fontSize: 13,
  },
  toast: {
    position: 'fixed', bottom: 24, left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff', padding: '10px 20px', borderRadius: 20,
    fontSize: 13, fontWeight: 600, zIndex: 2000,
    border: '1px solid #2a2d35',
  },
  loadingOverlay: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingCard: {
    backgroundColor: '#111318', border: '1px solid #2a2d35',
    borderRadius: 16, padding: '40px 48px', textAlign: 'center', minWidth: 320,
  },
  loadingMsg: { fontSize: 15, color: '#c0c0c0', marginBottom: 20 },
  progressBar: { height: 6, backgroundColor: '#1e2028', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 3, transition: 'width 0.3s ease' },
  progressPct: { fontSize: 13, color: '#555' },
  summaryCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    margin: '12px 24px 0', backgroundColor: '#0d1117', border: '1px solid #1e3a5f',
    borderRadius: 12, padding: '14px 20px', gap: 16, flexShrink: 0,
  },
  summaryLeft: { display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 },
  aiStar: { color: '#3b82f6', fontSize: 18, flexShrink: 0, marginTop: 1 },
  summaryHeadline: { fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 3 },
  summaryInsight: { fontSize: 13, color: '#888', lineHeight: 1.4 },
  noisePill: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    backgroundColor: '#16181f', borderRadius: 10, padding: '8px 14px',
    border: '1px solid #2a2d35', flexShrink: 0,
  },
  noiseNum: { fontSize: 20, fontWeight: 900, color: '#6b7280' },
  noiseLabel: { fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 },
  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 24px', borderBottom: '1px solid #1e2028',
    gap: 16, flexWrap: 'wrap', flexShrink: 0, marginTop: 12,
  },
  bucketPills: { display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 },
  bucketPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 20, border: '1px solid', fontSize: 12, backgroundColor: 'transparent',
  },
  pillDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  pillLabel: { color: '#c0c0c0', fontWeight: 500 },
  pillCount: { color: '#555', fontSize: 11 },
  removePill: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: '0 2px' },
  addBucket: { display: 'flex', gap: 8, alignItems: 'center' },
  bucketInput: {
    backgroundColor: '#111318', border: '1px solid #2a2d35',
    borderRadius: 8, padding: '6px 12px', color: '#f0f0f0',
    fontSize: 13, outline: 'none', width: 160,
  },
  addBtn: {
    backgroundColor: '#1d4ed8', border: 'none', borderRadius: 8,
    color: '#fff', padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  },
  columns: {
    display: 'flex', gap: 16, padding: '16px 24px',
    overflowX: 'auto', flex: 1, alignItems: 'flex-start',
  },
};

export default InboxView;
