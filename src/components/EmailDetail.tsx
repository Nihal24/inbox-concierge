import React, { useEffect, useState } from 'react';
import { ClassifiedEmail, summarizeEmail, InboxSummary } from '../utils/classify';
import { fetchEmailBody, trashThread } from '../utils/gmail';
import { saveSenderPreference } from '../utils/senderMemory';
import ConfirmModal from './ConfirmModal';

interface Props {
  email: ClassifiedEmail | null;
  accessToken: string;
  buckets: string[];
  bucketColors: Record<string, string>;
  inboxSummary: InboxSummary | null;
  isMobile?: boolean;
  onBack?: () => void;
  onMove: (emailId: string, newBucket: string) => void;
  onMemoryUpdate: () => void;
  onDelete: (emailId: string) => void;
}

function formatFrom(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from.replace(/<.*>/, '').trim() || from;
}

function extractEmailAddr(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const URGENCY_CONFIG = {
  high: { color: '#ef4444', label: 'High urgency', bg: '#fef2f2' },
  medium: { color: '#f59e0b', label: 'Medium urgency', bg: '#fffbeb' },
  low: { color: '#10b981', label: 'Low urgency', bg: '#f0fdf4' },
};

const EmptyState: React.FC<{ summary: InboxSummary | null }> = ({ summary }) => (
  <div style={emptyStyles.container}>
    <div style={emptyStyles.icon}>📬</div>
    <div style={emptyStyles.title}>Select an email to read</div>
    {summary && (
      <div style={emptyStyles.summaryCard}>
        <div style={emptyStyles.summaryHeader}>
          <span style={emptyStyles.aiStar}>✦</span>
          <span style={emptyStyles.summaryLabel}>AI Inbox Digest</span>
        </div>
        <div style={emptyStyles.headline}>{summary.headline}</div>
        <div style={emptyStyles.insight}>{summary.insight}</div>
        <div style={emptyStyles.noisePill}>
          <span style={emptyStyles.noiseNum}>{summary.noisePercent}%</span>
          <span style={emptyStyles.noiseLabel}> of your inbox is noise</span>
        </div>
      </div>
    )}
  </div>
);

const EmailDetail: React.FC<Props> = ({ email, accessToken, buckets, bucketColors, inboxSummary, isMobile, onBack, onMove, onMemoryUpdate, onDelete }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!email) return;
    setMovedTo(null);
    setSummary(null);
    setLoadingSummary(true);
    (async () => {
      const body = await fetchEmailBody(email.id, accessToken);
      const s = await summarizeEmail(email.subject, email.from, body || email.snippet);
      setSummary(s);
      setLoadingSummary(false);
    })();
  }, [email?.id, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!email) return <EmptyState summary={inboxSummary} />;

  const handleDelete = async () => {
    await trashThread(email.id, accessToken);
    setConfirmDelete(false);
    onDelete(email.id);
  };

  const handleMove = (bucket: string) => {
    saveSenderPreference(email.from, bucket);
    onMove(email.id, bucket);
    onMemoryUpdate();
    setMovedTo(bucket);
  };

  const currentBucket = movedTo || email.bucket;
  const bucketColor = bucketColors[currentBucket] || '#888';
  const urgency = email.urgency || 'low';
  const urgCfg = URGENCY_CONFIG[urgency];

  return (
    <>
    <div style={styles.pane}>
      {/* Email header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          {isMobile && onBack && (
            <button onClick={onBack} style={styles.backBtn}>←</button>
          )}
          <div style={styles.bucketTag}>
            <span style={{ ...styles.bucketDot, backgroundColor: bucketColor }} />
            <span style={{ ...styles.bucketLabel, color: bucketColor }}>{currentBucket}</span>
            {currentBucket === 'Action Required' && urgency !== 'low' && (
              <span style={{ ...styles.urgencyTag, color: urgCfg.color, backgroundColor: urgCfg.bg }}>
                {urgCfg.label}
              </span>
            )}
          </div>
          <div style={styles.headerActions}>
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${email.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.actionLink}
            >
              ↗ Open
            </a>
            <a
              href={`https://mail.google.com/mail/u/0/?view=cm&tf=1&in_reply_to=${email.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.actionLink, ...styles.actionLinkPrimary }}
            >
              ↩ Reply
            </a>
            <button onClick={() => setConfirmDelete(true)} style={styles.deleteBtn} title="Move to trash">🗑</button>
          </div>
        </div>
        <h2 style={styles.subject}>{email.subject}</h2>
        <div style={styles.meta}>
          <div style={styles.avatar}>{formatFrom(email.from).charAt(0).toUpperCase()}</div>
          <div style={styles.metaText}>
            <div style={styles.fromName}>{formatFrom(email.from)}</div>
            <div style={styles.fromEmail}>{extractEmailAddr(email.from)} · {formatDate(email.date)}</div>
          </div>
        </div>
      </div>

      <div style={styles.body}>
        {/* AI Summary */}
        <div style={styles.summaryCard}>
          <div style={styles.summaryHeader}>
            <span style={styles.aiStar}>✦</span>
            <span style={styles.summaryTitle}>AI Summary</span>
          </div>
          {loadingSummary ? (
            <div style={styles.shimmerWrap}>
              <div style={styles.shimmer} />
              <div style={{ ...styles.shimmer, width: '75%' }} />
            </div>
          ) : (
            <p style={styles.summaryText}>{summary}</p>
          )}
        </div>

        {/* Move to bucket */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>
            {movedTo ? `✓ Moved to ${movedTo}` : 'Move to bucket'}
          </div>
          {!movedTo && (
            <div style={styles.moveBuckets}>
              {buckets.filter((b) => b !== email.bucket).map((b) => (
                <button
                  key={b}
                  onClick={() => handleMove(b)}
                  style={{
                    ...styles.movePill,
                    borderColor: (bucketColors[b] || '#ccc') + '80',
                    color: bucketColors[b] || '#666',
                  }}
                >
                  <span style={{ ...styles.moveDot, backgroundColor: bucketColors[b] || '#666' }} />
                  {b}
                </button>
              ))}
            </div>
          )}
          {movedTo && (
            <p style={styles.movedNote}>Future emails from this sender will go to <strong>{movedTo}</strong>.</p>
          )}
        </div>
      </div>
    </div>
    {confirmDelete && (
      <ConfirmModal
        title="Move to trash?"
        message={`"${email.subject}" will be moved to your Gmail trash.`}
        confirmLabel="Trash"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  pane: {
    flex: 1,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 28px 18px',
    borderBottom: '1px solid #f0f0f5',
    flexShrink: 0,
    backgroundColor: '#fff',
  },
  headerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bucketTag: { display: 'flex', alignItems: 'center', gap: 8 },
  bucketDot: { width: 7, height: 7, borderRadius: '50%' },
  bucketLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 },
  urgencyTag: {
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
  },
  headerActions: { display: 'flex', gap: 8 },
  actionLink: {
    fontSize: 12, fontWeight: 600, color: '#666',
    textDecoration: 'none', padding: '5px 12px',
    border: '1px solid #e5e7eb', borderRadius: 7,
    backgroundColor: '#fafafa',
  },
  actionLinkPrimary: {
    backgroundColor: '#1d4ed8', color: '#fff', border: 'none',
  },
  deleteBtn: {
    background: 'none', border: '1px solid #e5e7eb', borderRadius: 7,
    padding: '5px 10px', cursor: 'pointer', fontSize: 13,
    color: '#999', backgroundColor: '#fafafa',
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 18, color: '#555', padding: '0 10px 0 0', lineHeight: 1, flexShrink: 0,
  },
  subject: {
    fontSize: 20, fontWeight: 700, color: '#1a1a1a',
    margin: '0 0 14px', lineHeight: 1.3, letterSpacing: -0.3,
  },
  meta: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    backgroundColor: '#e8e8ec', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, color: '#666', flexShrink: 0,
  },
  metaText: {},
  fromName: { fontSize: 13, fontWeight: 600, color: '#1a1a1a' },
  fromEmail: { fontSize: 11, color: '#999', marginTop: 1 },
  body: { flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 },
  summaryCard: {
    backgroundColor: '#f8faff',
    border: '1px solid #dbeafe',
    borderRadius: 12,
    padding: '16px 18px',
  },
  summaryHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  aiStar: { color: '#2563eb', fontSize: 14 },
  summaryTitle: { fontSize: 11, color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  shimmerWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  shimmer: { height: 13, backgroundColor: '#e8edf5', borderRadius: 4, width: '100%' },
  summaryText: { fontSize: 14, color: '#374151', lineHeight: 1.65, margin: 0 },
  section: {},
  sectionLabel: { fontSize: 11, color: '#bbb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  previewText: { fontSize: 13, color: '#666', lineHeight: 1.6, margin: 0 },
  moveBuckets: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  movePill: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'none', border: '1px solid', borderRadius: 20,
    padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  moveDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  movedNote: { fontSize: 12, color: '#999', margin: 0 },
};

const emptyStyles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1, backgroundColor: '#ffffff',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    height: '100vh', padding: 40,
  },
  icon: { fontSize: 40, marginBottom: 12, opacity: 0.3 },
  title: { fontSize: 14, color: '#bbb', marginBottom: 32 },
  summaryCard: {
    backgroundColor: '#f8faff', border: '1px solid #dbeafe',
    borderRadius: 14, padding: '20px 24px', maxWidth: 380, width: '100%',
  },
  summaryHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  aiStar: { color: '#2563eb', fontSize: 14 },
  summaryLabel: { fontSize: 11, color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  headline: { fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 },
  insight: { fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 14 },
  noisePill: { display: 'flex', alignItems: 'baseline', gap: 2 },
  noiseNum: { fontSize: 24, fontWeight: 900, color: '#6b7280' },
  noiseLabel: { fontSize: 12, color: '#999' },
};

export default EmailDetail;
