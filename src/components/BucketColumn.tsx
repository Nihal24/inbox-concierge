import React from 'react';
import { ClassifiedEmail } from '../utils/classify';

interface Props {
  bucket: string;
  emails: ClassifiedEmail[];
  color: string;
  onEmailClick: (email: ClassifiedEmail) => void;
  onBulkArchive?: () => void;
}

function formatFrom(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from.replace(/<.*>/, '').trim() || from;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const URGENCY_CONFIG = {
  high: { color: '#ef4444', label: '●' },
  medium: { color: '#f59e0b', label: '●' },
  low: { color: 'transparent', label: '' },
};

const ARCHIVABLE = ['Newsletter', 'Auto-archive', 'Social'];

const BucketColumn: React.FC<Props> = ({ bucket, emails, color, onEmailClick, onBulkArchive }) => {
  const showArchive = ARCHIVABLE.includes(bucket) && emails.length > 0 && onBulkArchive;

  // Sort Important by urgency: high → medium → low
  const sortedEmails = bucket === 'Important'
    ? [...emails].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.urgency || 'low']) - (order[b.urgency || 'low']);
      })
    : emails;

  return (
    <div style={styles.column}>
      <div style={{ ...styles.header, borderColor: color }}>
        <span style={{ ...styles.dot, backgroundColor: color }} />
        <span style={styles.bucketName}>{bucket}</span>
        <span style={styles.count}>{emails.length}</span>
        {showArchive && (
          <button onClick={onBulkArchive} style={{ ...styles.archiveBtn, borderColor: color + '60', color }}>
            Clear
          </button>
        )}
      </div>
      <div style={styles.emailList}>
        {sortedEmails.length === 0 ? (
          <div style={styles.empty}>No emails</div>
        ) : (
          sortedEmails.map((e) => {
            const urgency = e.urgency || 'low';
            const urg = URGENCY_CONFIG[urgency];
            return (
              <div
                key={e.id}
                style={{
                  ...styles.emailCard,
                  borderLeft: `3px solid ${e.unread ? color : 'transparent'}`,
                }}
                onClick={() => onEmailClick(e)}
              >
                <div style={styles.emailTop}>
                  <span style={{ ...styles.from, fontWeight: e.unread ? 700 : 400 }}>
                    {formatFrom(e.from)}
                  </span>
                  <div style={styles.topRight}>
                    {bucket === 'Important' && urgency !== 'low' && (
                      <span style={{ color: urg.color, fontSize: 8, marginRight: 4 }}>{urg.label}</span>
                    )}
                    <span style={styles.date}>{formatDate(e.date)}</span>
                  </div>
                </div>
                <div style={{ ...styles.subject, fontWeight: e.unread ? 600 : 400 }}>
                  {e.subject}
                </div>
                <div style={styles.snippet}>{e.snippet}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  column: {
    flex: '0 0 300px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#111318',
    borderRadius: 12,
    border: '1px solid #2a2d35',
    overflow: 'hidden',
    maxHeight: 'calc(100vh - 160px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '2px solid',
    backgroundColor: '#16181f',
    flexShrink: 0,
  },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  bucketName: {
    flex: 1,
    fontWeight: 700,
    fontSize: 13,
    color: '#f0f0f0',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  count: {
    fontSize: 12, color: '#666', backgroundColor: '#222',
    borderRadius: 10, padding: '2px 8px', fontWeight: 600,
  },
  archiveBtn: {
    background: 'none',
    border: '1px solid',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
    fontWeight: 600,
    flexShrink: 0,
  },
  emailList: { overflowY: 'auto', flex: 1, padding: '8px 0' },
  empty: { color: '#444', fontSize: 13, textAlign: 'center', padding: '40px 16px' },
  emailCard: {
    padding: '10px 14px',
    borderBottom: '1px solid #1e2028',
    cursor: 'pointer',
    transition: 'background 0.12s',
  },
  emailTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  topRight: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  from: {
    fontSize: 13, color: '#e0e0e0', flex: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8,
  },
  date: { fontSize: 11, color: '#555' },
  subject: {
    fontSize: 13, color: '#c0c0c0', marginBottom: 4,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  snippet: {
    fontSize: 12, color: '#555',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
};

export default BucketColumn;
