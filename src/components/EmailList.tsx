import React from 'react';
import { ClassifiedEmail } from '../utils/classify';

interface Props {
  bucket: string;
  emails: ClassifiedEmail[];
  selectedId: string | null;
  bucketColor: string;
  onSelect: (email: ClassifiedEmail) => void;
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

const URGENCY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: 'transparent' };
const URGENCY_BUCKET = 'Action Required';

const EmailList: React.FC<Props> = ({ bucket, emails, selectedId, bucketColor, onSelect }) => {
  const sorted = bucket === 'Action Required'
    ? [...emails].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.urgency || 'low'] - order[b.urgency || 'low'];
      })
    : emails;

  return (
    <div style={styles.pane}>
      {/* Pane header */}
      <div style={styles.header}>
        <span style={{ ...styles.bucketDot, backgroundColor: bucketColor }} />
        <span style={styles.bucketName}>{bucket}</span>
        <span style={styles.count}>{emails.length}</span>
      </div>

      {/* List */}
      <div style={styles.list}>
        {sorted.length === 0 ? (
          <div style={styles.empty}>No emails in this bucket</div>
        ) : (
          sorted.map((e) => {
            const selected = e.id === selectedId;
            const urgencyColor = URGENCY_COLORS[e.urgency || 'low'];
            return (
              <div
                key={e.id}
                onClick={() => onSelect(e)}
                style={{
                  ...styles.emailRow,
                  backgroundColor: selected ? '#ffffff' : 'transparent',
                  borderLeft: `3px solid ${selected ? bucketColor : e.unread ? bucketColor + '80' : 'transparent'}`,
                }}
              >
                {/* Always reserve dot space for consistent alignment; only color in Action Required */}
                <span style={{
                  ...styles.urgencyDot,
                  backgroundColor: bucket === URGENCY_BUCKET ? urgencyColor : 'transparent',
                }} />
                <div style={styles.emailContent}>
                  <div style={styles.topRow}>
                    <span style={{
                      ...styles.from,
                      fontWeight: e.unread ? 700 : 500,
                      color: selected ? '#1a1a1a' : e.unread ? '#111' : '#666',
                    }}>
                      {formatFrom(e.from)}
                    </span>
                    <span style={{ ...styles.date, color: selected ? '#888' : '#777' }}>
                      {formatDate(e.date)}
                    </span>
                  </div>
                  <div style={{
                    ...styles.subject,
                    fontWeight: e.unread ? 600 : 400,
                    color: selected ? '#1a1a1a' : e.unread ? '#222' : '#777',
                  }}>
                    {e.subject}
                  </div>
                  <div style={{ ...styles.snippet, color: selected ? '#666' : '#999' }}>
                    {e.snippet}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  pane: {
    width: 320,
    flexShrink: 0,
    backgroundColor: '#f4f5f7',
    borderRight: '1px solid #e0e0e5',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '18px 16px 14px',
    borderBottom: '1px solid #e0e0e5',
    backgroundColor: '#f4f5f7',
    flexShrink: 0,
  },
  bucketDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  bucketName: { flex: 1, fontSize: 14, fontWeight: 700, color: '#1a1a1a', letterSpacing: -0.2 },
  count: {
    fontSize: 11, color: '#999', backgroundColor: '#e8e8ec',
    borderRadius: 10, padding: '2px 8px', fontWeight: 600,
  },
  list: { overflowY: 'auto', flex: 1 },
  empty: { color: '#bbb', fontSize: 13, textAlign: 'center', padding: '48px 20px' },
  emailRow: {
    display: 'flex', alignItems: 'flex-start', gap: 0,
    padding: '12px 14px 12px 0',
    borderBottom: '1px solid #e8e8ec',
    cursor: 'pointer',
    transition: 'background 0.1s',
    position: 'relative',
  },
  urgencyDot: {
    width: 6, height: 6, borderRadius: '50%',
    flexShrink: 0, marginTop: 6, marginLeft: 10, marginRight: 6,
  },
  emailContent: { flex: 1, minWidth: 0, paddingLeft: 4 },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  from: { fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 },
  date: { fontSize: 11, flexShrink: 0 },
  subject: { fontSize: 12, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  snippet: { fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};

export default EmailList;
