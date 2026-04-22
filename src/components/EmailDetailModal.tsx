import React, { useEffect, useState } from 'react';
import { ClassifiedEmail, summarizeEmail } from '../utils/classify';
import { fetchEmailBody } from '../utils/gmail';
import { saveSenderPreference } from '../utils/senderMemory';

interface Props {
  email: ClassifiedEmail;
  accessToken: string;
  bucketColor: string;
  buckets: string[];
  bucketColors: Record<string, string>;
  onClose: () => void;
  onMove: (emailId: string, newBucket: string) => void;
}

function formatFrom(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from.replace(/<.*>/, '').trim() || from;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const URGENCY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };
const URGENCY_LABELS = { high: '🔴 High urgency', medium: '🟡 Medium urgency', low: '🟢 Low urgency' };

const EmailDetailModal: React.FC<Props> = ({ email, accessToken, bucketColor, buckets, bucketColors, onClose, onMove }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [movedTo, setMovedTo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingSummary(true);
      const body = await fetchEmailBody(email.id, accessToken);
      const s = await summarizeEmail(email.subject, email.from, body || email.snippet);
      setSummary(s);
      setLoadingSummary(false);
    })();
  }, [email.id, email.subject, email.from, email.snippet, accessToken]);

  const handleMove = (bucket: string) => {
    saveSenderPreference(email.from, bucket);
    onMove(email.id, bucket);
    setMovedTo(bucket);
    setTimeout(onClose, 800);
  };

  const currentBucket = movedTo || email.bucket;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={styles.bucketTag}>
            <span style={{ ...styles.bucketDot, backgroundColor: movedTo ? bucketColors[movedTo] : bucketColor }} />
            <span style={styles.bucketLabel}>{currentBucket}</span>
            {email.bucket === 'Important' && email.urgency && !movedTo && (
              <span style={{ ...styles.urgencyChip, color: URGENCY_COLORS[email.urgency] }}>
                {URGENCY_LABELS[email.urgency]}
              </span>
            )}
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Subject */}
        <div style={styles.subject}>{email.subject}</div>

        {/* Meta */}
        <div style={styles.meta}>
          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>From</span>
            <span style={styles.metaValue}>{formatFrom(email.from)}</span>
          </div>
          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>Date</span>
            <span style={styles.metaValue}>{formatDate(email.date)}</span>
          </div>
        </div>

        {/* AI Summary */}
        <div style={styles.summaryCard}>
          <div style={styles.summaryHeader}>
            <span style={styles.aiIcon}>✦</span>
            <span style={styles.summaryTitle}>AI Summary</span>
          </div>
          {loadingSummary ? (
            <div style={styles.summaryLoading}>
              <div style={styles.shimmer} />
              <div style={{ ...styles.shimmer, width: '70%' }} />
            </div>
          ) : (
            <p style={styles.summaryText}>{summary}</p>
          )}
        </div>

        {/* Snippet */}
        <div style={styles.snippetSection}>
          <div style={styles.snippetLabel}>Preview</div>
          <p style={styles.snippetText}>{email.snippet}</p>
        </div>

        {/* Move to bucket */}
        <div style={styles.moveSection}>
          <div style={styles.moveLabel}>
            {movedTo
              ? `✓ Moved to ${movedTo} — future emails from this sender will go here`
              : 'Wrong bucket? Move to:'}
          </div>
          {!movedTo && (
            <div style={styles.moveBuckets}>
              {buckets.filter((b) => b !== email.bucket).map((b) => (
                <button
                  key={b}
                  onClick={() => handleMove(b)}
                  style={{
                    ...styles.moveBucketBtn,
                    borderColor: bucketColors[b] || '#444',
                    color: bucketColors[b] || '#888',
                  }}
                >
                  <span style={{ ...styles.moveDot, backgroundColor: bucketColors[b] || '#444' }} />
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <a
            href={`https://mail.google.com/mail/u/0/#inbox/${email.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.actionBtnPrimary}
          >
            ↗ Open in Gmail
          </a>
          <a
            href={`https://mail.google.com/mail/u/0/?view=cm&tf=1&in_reply_to=${email.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.actionBtnSecondary}
          >
            ↩ Reply
          </a>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(4px)',
  },
  modal: {
    backgroundColor: '#111318', border: '1px solid #2a2d35',
    borderRadius: 16, padding: 28, maxWidth: 560, width: '90%',
    maxHeight: '85vh', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  bucketTag: { display: 'flex', alignItems: 'center', gap: 8 },
  bucketDot: { width: 8, height: 8, borderRadius: '50%' },
  bucketLabel: { fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  urgencyChip: { fontSize: 12, fontWeight: 600, marginLeft: 8 },
  closeBtn: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: '4px 8px' },
  subject: { fontSize: 20, fontWeight: 700, color: '#f0f0f0', lineHeight: 1.3 },
  meta: {
    display: 'flex', flexDirection: 'column', gap: 6,
    backgroundColor: '#16181f', borderRadius: 10, padding: '12px 16px',
  },
  metaRow: { display: 'flex', gap: 12, alignItems: 'baseline' },
  metaLabel: { fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, width: 40, flexShrink: 0 },
  metaValue: { fontSize: 13, color: '#c0c0c0' },
  summaryCard: {
    backgroundColor: '#0d1117', border: '1px solid #1e3a5f', borderRadius: 12, padding: '14px 16px',
  },
  summaryHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  aiIcon: { color: '#3b82f6', fontSize: 14 },
  summaryTitle: { fontSize: 12, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryLoading: { display: 'flex', flexDirection: 'column', gap: 8 },
  shimmer: { height: 14, backgroundColor: '#1e2028', borderRadius: 4, width: '100%' },
  summaryText: { fontSize: 14, color: '#d0d0d0', lineHeight: 1.6, margin: 0 },
  snippetSection: {},
  snippetLabel: { fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  snippetText: { fontSize: 13, color: '#666', lineHeight: 1.5, margin: 0 },
  moveSection: {
    backgroundColor: '#16181f', borderRadius: 10, padding: '12px 14px',
    border: '1px solid #2a2d35',
  },
  moveLabel: { fontSize: 11, color: '#666', fontWeight: 600, marginBottom: 10, letterSpacing: 0.3 },
  moveBuckets: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  moveBucketBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'none', border: '1px solid', borderRadius: 20,
    padding: '4px 12px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
  },
  moveDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  actions: { display: 'flex', gap: 10 },
  actionBtnPrimary: {
    flex: 1, textAlign: 'center' as const, padding: '10px 16px',
    backgroundColor: '#1d4ed8', borderRadius: 10,
    color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
  },
  actionBtnSecondary: {
    flex: 1, textAlign: 'center' as const, padding: '10px 16px',
    backgroundColor: '#16181f', border: '1px solid #2a2d35', borderRadius: 10,
    color: '#c0c0c0', fontWeight: 600, fontSize: 14, textDecoration: 'none',
  },
};

export default EmailDetailModal;
