import React, { useEffect, useState, useCallback, useRef } from 'react';
import { fetchThreads, EmailThread, getLastFetchedTimestamp, trashThread, trashThreads } from '../utils/gmail';
import { classifyEmails, ClassifiedEmail, DEFAULT_BUCKETS, generateInboxSummary, InboxSummary, buildContextExamples, ClassificationExample } from '../utils/classify';
import { getMemoryCount, getCustomBuckets, saveCustomBuckets, getRemovedDefaultBuckets, saveRemovedDefaultBuckets } from '../utils/senderMemory';
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
  const [buckets, setBuckets] = useState<string[]>(() => {
    const removed = getRemovedDefaultBuckets();
    return [...DEFAULT_BUCKETS.filter((b) => !removed.includes(b)), ...getCustomBuckets()];
  });
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
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileView, setMobileView] = useState<'sidebar' | 'list' | 'detail'>('sidebar');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Keep a ref to the latest token so silent refreshes don't re-trigger the initial load
  const tokenRef = useRef(accessToken);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;
  const sonnetContextRef = useRef<ClassificationExample[]>([]);

  const bucketColorMap = Object.fromEntries(buckets.map((b) => [b, getBucketColor(b, buckets)]));

  const runClassification = useCallback(async (threads: EmailThread[], currentBuckets: string[], model = 'claude-sonnet-4-6') => {
    setReclassifying(true);
    setProgress(0);
    setSummary(null);
    setSelectedEmail(null);
    setError(null);
    try {
      const classified = await classifyEmails(threads, currentBuckets, (pct) => setProgress(pct), model);
      sonnetContextRef.current = buildContextExamples(classified);
      setEmails(classified);
      const s = await generateInboxSummary(classified);
      setSummary(s);
    } catch (err: any) {
      setError(err?.message || 'Classification failed. Please try again.');
    } finally {
      setReclassifying(false);
    }
  }, []);

  // Run once on mount — tokenRef always has the current token
  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadingMsg('Fetching your emails...');
      setProgress(0);
      setError(null);
      try {
        const threads = await fetchThreads(tokenRef.current);
        setRawThreads(threads);
        setProgress(20);
        setLoadingMsg(`Classifying ${threads.length} emails with AI...`);
        const classified = await classifyEmails(threads, bucketsRef.current, (pct) =>
          setProgress(20 + Math.round(pct * 0.75)), 'claude-sonnet-4-6'
        );
        sonnetContextRef.current = buildContextExamples(classified);
        setEmails(classified);
        setMemoryCount(getMemoryCount());
        const s = await generateInboxSummary(classified);
        setSummary(s);
      } catch (err: any) {
        setError(err?.message || 'Failed to load inbox. Please reload.');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    const lastTs = getLastFetchedTimestamp();
    if (!lastTs) return;
    setRefreshing(true);
    setNewEmailCount(null);
    try {
      const newThreads = await fetchThreads(tokenRef.current, lastTs);
      const existingIds = new Set(rawThreads.map((t) => t.id));
      const brandNew = newThreads.filter((t) => !existingIds.has(t.id));
      if (brandNew.length === 0) {
        setNewEmailCount(0);
        setTimeout(() => setNewEmailCount(null), 3000);
        return;
      }
      const classified = await classifyEmails(brandNew, bucketsRef.current, () => {}, 'claude-haiku-4-5-20251001', sonnetContextRef.current);
      setEmails((prev) => [...classified, ...prev]);
      setRawThreads((prev) => [...brandNew, ...prev]);
      setNewEmailCount(brandNew.length);
      setTimeout(() => setNewEmailCount(null), 4000);
    } catch (err: any) {
      // Non-fatal — refresh failures are silent, user can retry
      console.error('Refresh failed:', err);
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
    if (buckets.length <= 1) return; // always keep at least one
    const updated = buckets.filter((b) => b !== bucket);
    setBuckets(updated);
    saveCustomBuckets(updated.filter((b) => !DEFAULT_BUCKETS.includes(b)));
    saveRemovedDefaultBuckets(DEFAULT_BUCKETS.filter((b) => !updated.includes(b)));
    if (selectedBucket === bucket) setSelectedBucket(updated[0]);
    runClassification(rawThreads, updated);
  };

  const handleMove = (emailId: string, newBucketName: string) => {
    setEmails((prev) => prev.map((e) => e.id === emailId ? { ...e, bucket: newBucketName } : e));
    setSelectedEmail((prev) => prev?.id === emailId ? { ...prev, bucket: newBucketName } : prev);
  };

  const handleDeleteEmail = async (emailId: string) => {
    await trashThread(emailId, tokenRef.current);
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    setRawThreads((prev) => prev.filter((t) => t.id !== emailId));
    if (selectedEmail?.id === emailId) setSelectedEmail(null);
  };

  const handleDeleteAll = async (emailIds: string[]) => {
    await trashThreads(emailIds, tokenRef.current);
    const idSet = new Set(emailIds);
    setEmails((prev) => prev.filter((e) => !idSet.has(e.id)));
    setRawThreads((prev) => prev.filter((t) => !idSet.has(t.id)));
    if (selectedEmail && idSet.has(selectedEmail.id)) setSelectedEmail(null);
  };

  const emailsForBucket = emails.filter((e) => e.bucket === selectedBucket);

  if (error && loading) {
    return (
      <div style={loadingStyles.screen}>
        <div style={loadingStyles.card}>
          <div style={loadingStyles.logo}>⚠️</div>
          <div style={loadingStyles.title}>Failed to load inbox</div>
          <div style={loadingStyles.msg}>{error}</div>
          <button style={loadingStyles.retryBtn} onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

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

  const sidebarEl = (
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
      isMobile={isMobile}
      onSelectBucket={(b) => {
        setSelectedBucket(b);
        setSelectedEmail(null);
        if (isMobile) setMobileView('list');
      }}
      onRefresh={handleRefresh}
      onReclassify={() => runClassification(rawThreads, bucketsRef.current)}
      onShowAnalytics={() => setShowAnalytics(true)}
      onAddBucket={addBucket}
      onRemoveBucket={removeBucket}
      onNewBucketChange={setNewBucket}
      onSignOut={onSignOut}
    />
  );

  const listEl = (
    <EmailList
      bucket={selectedBucket}
      emails={emailsForBucket}
      selectedId={selectedEmail?.id || null}
      bucketColor={bucketColorMap[selectedBucket]}
      isMobile={isMobile}
      onBack={isMobile ? () => setMobileView('sidebar') : undefined}
      onSelect={(e) => {
        setSelectedEmail(e);
        if (isMobile) setMobileView('detail');
      }}
      onDeleteAll={handleDeleteAll}
    />
  );

  const detailEl = (
    <EmailDetail
      email={selectedEmail}
      accessToken={accessToken}
      buckets={buckets}
      bucketColors={bucketColorMap}
      inboxSummary={summary}
      isMobile={isMobile}
      onBack={isMobile ? () => setMobileView('list') : undefined}
      onMove={handleMove}
      onDelete={handleDeleteEmail}
      onMemoryUpdate={() => setMemoryCount(getMemoryCount())}
    />
  );

  const analyticsEl = showAnalytics && (
    <AnalyticsPanel
      emails={emails}
      bucketColors={bucketColorMap}
      onClose={() => setShowAnalytics(false)}
    />
  );

  if (isMobile) {
    return (
      <div style={{ height: '100vh', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {mobileView === 'sidebar' && sidebarEl}
        {mobileView === 'list' && listEl}
        {mobileView === 'detail' && detailEl}
        {analyticsEl}
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      {sidebarEl}
      {listEl}
      {detailEl}
      {analyticsEl}
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
  retryBtn: {
    backgroundColor: '#1d4ed8', border: 'none', borderRadius: 8,
    color: '#fff', padding: '10px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
};

export default InboxView;
