import React, { useEffect, useState, useCallback, useRef } from 'react';
import { fetchThreads, EmailThread, getLastFetchedTimestamp } from '../utils/gmail';
import { classifyEmails, ClassifiedEmail, DEFAULT_BUCKETS, generateInboxSummary, InboxSummary } from '../utils/classify';
import { getMemoryCount, getCustomBuckets, saveCustomBuckets } from '../utils/senderMemory';
import { clearClassificationCache } from '../utils/classify';
import Sidebar from './Sidebar';
import EmailList from './EmailList';
import EmailDetail from './EmailDetail';
import AnalyticsPanel from './AnalyticsPanel';

interface Props {
  accessToken: string;
  userEmail: string;
  onSignOut: () => void;
}

const BUCKET_COLORS: Record<string, string> = {
  'Action Required': '#ef4444',
  'Heads Up': '#f59e0b',
  'Newsletter': '#8b5cf6',
  'Social': '#10b981',
  'Junk': '#6b7280',
};
const EXTRA_COLORS = ['#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

function getBucketColor(bucket: string, allBuckets: string[]): string {
  if (BUCKET_COLORS[bucket]) return BUCKET_COLORS[bucket];
  const idx = allBuckets.indexOf(bucket) - DEFAULT_BUCKETS.length;
  return EXTRA_COLORS[idx % EXTRA_COLORS.length];
}

const InboxView: React.FC<Props> = ({ accessToken, userEmail, onSignOut }) => {
  const [emails, setEmails] = useState<ClassifiedEmail[]>([]);
  const [buckets, setBuckets] = useState<string[]>(() => [...DEFAULT_BUCKETS, ...getCustomBuckets()]);
  const [selectedBucket, setSelectedBucket] = useState<string>(DEFAULT_BUCKETS[0]);
  const [selectedEmail, setSelectedEmail] = useState<ClassifiedEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Fetching emails...');
  const [progress, setProgress] = useState(0);
  const [rawThreads, setRawThreads] = useState<EmailThread[]>([]);
  const [newBucket, setNewBucket] = useState('');
  const [reclassifying, setReclassifying] = useState(false);
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newEmailCount, setNewEmailCount] = useState<number | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);

  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;

  const bucketColorMap = Object.fromEntries(buckets.map((b) => [b, getBucketColor(b, buckets)]));

  const runClassification = useCallback(async (threads: EmailThread[], currentBuckets: string[], force = false) => {
    setReclassifying(true);
    setProgress(0);
    setSummary(null);
    setSelectedEmail(null);
    const classified = await classifyEmails(threads, currentBuckets, (pct) => setProgress(pct), force);
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

  const addBucket = () => {
    const name = newBucket.trim();
    if (!name || buckets.includes(name)) return;
    const updated = [...buckets, name];
    setBuckets(updated);
    setNewBucket('');
    saveCustomBuckets(updated.filter((b) => !DEFAULT_BUCKETS.includes(b)));
    runClassification(rawThreads, updated);
  };

  const removeBucket = (bucket: string) => {
    if (DEFAULT_BUCKETS.includes(bucket)) return;
    const updated = buckets.filter((b) => b !== bucket);
    setBuckets(updated);
    saveCustomBuckets(updated.filter((b) => !DEFAULT_BUCKETS.includes(b)));
    if (selectedBucket === bucket) setSelectedBucket(DEFAULT_BUCKETS[0]);
    runClassification(rawThreads, updated);
  };

  const handleMove = (emailId: string, newBucketName: string) => {
    setEmails((prev) => prev.map((e) => e.id === emailId ? { ...e, bucket: newBucketName } : e));
    setSelectedEmail((prev) => prev?.id === emailId ? { ...prev, bucket: newBucketName } : prev);
  };

  const emailsForBucket = emails.filter((e) => e.bucket === selectedBucket);

  if (loading || reclassifying) {
    return (
      <div style={loadingStyles.screen}>
        <div style={loadingStyles.card}>
          <div style={loadingStyles.logo}>📬</div>
          <div style={loadingStyles.title}>Inbox Concierge</div>
          <div style={loadingStyles.msg}>{loadingMsg}</div>
          <div style={loadingStyles.bar}>
            <div style={{ ...loadingStyles.fill, width: `${progress}%` }} />
          </div>
          <div style={loadingStyles.pct}>{progress}%</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      <Sidebar
        buckets={buckets}
        selectedBucket={selectedBucket}
        emails={emails}
        bucketColors={bucketColorMap}
        memoryCount={memoryCount}
        refreshing={refreshing}
        newEmailCount={newEmailCount}
        userEmail={userEmail}
        newBucket={newBucket}
        onSelectBucket={(b) => { setSelectedBucket(b); setSelectedEmail(null); }}
        onRefresh={handleRefresh}
        onReclassify={() => { clearClassificationCache(); runClassification(rawThreads, bucketsRef.current, true); }}
        onShowAnalytics={() => setShowAnalytics(true)}
        onAddBucket={addBucket}
        onRemoveBucket={removeBucket}
        onNewBucketChange={setNewBucket}
        onSignOut={onSignOut}
      />

      <EmailList
        bucket={selectedBucket}
        emails={emailsForBucket}
        selectedId={selectedEmail?.id || null}
        bucketColor={bucketColorMap[selectedBucket]}
        onSelect={setSelectedEmail}
      />

      <EmailDetail
        email={selectedEmail}
        accessToken={accessToken}
        buckets={buckets}
        bucketColors={bucketColorMap}
        inboxSummary={summary}
        onMove={handleMove}
        onMemoryUpdate={() => setMemoryCount(getMemoryCount())}
      />

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
  shell: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
};

const loadingStyles: Record<string, React.CSSProperties> = {
  screen: {
    height: '100vh', backgroundColor: '#13141a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    backgroundColor: '#1a1b23', border: '1px solid #2a2d35',
    borderRadius: 16, padding: '44px 52px', textAlign: 'center', minWidth: 340,
  },
  logo: { fontSize: 36, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 800, color: '#f0f0f0', letterSpacing: -0.5, marginBottom: 4 },
  msg: { fontSize: 14, color: '#666', marginBottom: 24 },
  bar: { height: 4, backgroundColor: '#1e2028', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  fill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 2, transition: 'width 0.3s ease' },
  pct: { fontSize: 12, color: '#555' },
};

export default InboxView;
