import React, { useState } from 'react';
import { ClassifiedEmail, DEFAULT_BUCKETS, BUCKET_DESCRIPTIONS } from '../utils/classify';

interface Props {
  buckets: string[];
  selectedBucket: string;
  emails: ClassifiedEmail[];
  bucketColors: Record<string, string>;
  memoryCount: number;
  refreshing: boolean;
  newEmailCount: number | null;
  userEmail: string;
  newBucket: string;
  onSelectBucket: (b: string) => void;
  onRefresh: () => void;
  onReclassify: () => void;
  onShowAnalytics: () => void;
  onAddBucket: () => void;
  onRemoveBucket: (b: string) => void;
  onNewBucketChange: (v: string) => void;
  onSignOut: () => void;
}

const Sidebar: React.FC<Props> = ({
  buckets, selectedBucket, emails, bucketColors,
  memoryCount, refreshing, newEmailCount, userEmail, newBucket,
  onSelectBucket, onRefresh, onReclassify, onShowAnalytics, onAddBucket,
  onRemoveBucket, onNewBucketChange, onSignOut,
}) => {
  const [addingBucket, setAddingBucket] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const countFor = (b: string) => emails.filter((e) => e.bucket === b).length;
  const unreadFor = (b: string) => emails.filter((e) => e.bucket === b && e.unread).length;

  return (
    <div style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logoRow}>
        <span style={styles.logoIcon}>📬</span>
        <div>
          <div style={styles.appName}>Inbox Concierge</div>
          <div style={styles.userEmail}>{userEmail}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button onClick={onRefresh} disabled={refreshing} style={styles.actionBtn}>
          <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: refreshing ? 'transform 1s linear' : 'none' }}>↻</span>
          <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          {newEmailCount !== null && newEmailCount > 0 && (
            <span style={styles.newBadge}>{newEmailCount} new</span>
          )}
        </button>
        <button onClick={onShowAnalytics} style={styles.actionBtn}>
          <span>📊</span><span>Analytics</span>
        </button>
        <button onClick={onReclassify} style={styles.actionBtn}>
          <span>✦</span><span>Re-classify</span>
        </button>
      </div>

      <div style={styles.divider} />

      {/* Bucket list */}
      <div style={styles.bucketList}>
        <div style={styles.sectionLabel}>Buckets</div>
        {buckets.map((b) => {
          const active = selectedBucket === b;
          const count = countFor(b);
          const unread = unreadFor(b);
          return (
            <div
              key={b}
              onClick={() => onSelectBucket(b)}
              style={{
                ...styles.bucketRow,
                backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              <span style={{ ...styles.bucketDot, backgroundColor: bucketColors[b] || '#666' }} />
              <span style={{ ...styles.bucketName, fontWeight: active ? 700 : 400 }}>{b}</span>
              <div style={styles.bucketMeta}>
                {unread > 0 && <span style={{ ...styles.unreadDot, backgroundColor: bucketColors[b] || '#666' }} />}
                <span style={styles.bucketCount}>{count}</span>
              </div>
              {!DEFAULT_BUCKETS.includes(b) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveBucket(b); }}
                  style={styles.removeBtn}
                >×</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add bucket */}
      <div style={styles.addSection}>
        {addingBucket ? (
          <div style={styles.addRow}>
            <input
              autoFocus
              style={styles.bucketInput}
              placeholder="Bucket name..."
              value={newBucket}
              onChange={(e) => onNewBucketChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onAddBucket(); setAddingBucket(false); }
                if (e.key === 'Escape') { setAddingBucket(false); onNewBucketChange(''); }
              }}
            />
            <button onClick={() => { onAddBucket(); setAddingBucket(false); }} style={styles.addConfirmBtn}>+</button>
          </div>
        ) : (
          <button onClick={() => setAddingBucket(true)} style={styles.addBucketBtn}>
            + Add bucket
          </button>
        )}
      </div>

      <div style={styles.spacer} />

      {/* Footer */}
      <div style={styles.footer}>
        {/* Legend toggle */}
        <button onClick={() => setShowLegend(v => !v)} style={styles.legendToggle}>
          {showLegend ? '▾' : '▸'} Bucket guide
        </button>
        {showLegend && (
          <div style={styles.legend}>
            {[...DEFAULT_BUCKETS, ...Object.keys(BUCKET_DESCRIPTIONS).filter(k => !DEFAULT_BUCKETS.includes(k))].map((b) => {
              const desc = BUCKET_DESCRIPTIONS[b];
              if (!desc) return null;
              return (
                <div key={b} style={styles.legendRow}>
                  <span style={{ ...styles.legendDot, backgroundColor: bucketColors[b] || '#666' }} />
                  <div>
                    <div style={styles.legendName}>{b}</div>
                    <div style={styles.legendDesc}>{desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {memoryCount > 0 && (
          <div style={styles.memoryChip}>🧠 {memoryCount} sender{memoryCount > 1 ? 's' : ''} learned</div>
        )}
        <button onClick={onSignOut} style={styles.signOutBtn}>Sign out</button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    flexShrink: 0,
    backgroundColor: '#13141a',
    borderRight: '1px solid #1e2028',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '20px 16px 16px',
    borderBottom: '1px solid #1e2028',
  },
  logoIcon: { fontSize: 22, flexShrink: 0 },
  appName: { fontSize: 13, fontWeight: 800, color: '#f0f0f0', letterSpacing: -0.3 },
  userEmail: { fontSize: 10, color: '#444', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 },
  actions: { padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  actionBtn: {
    background: 'none', border: 'none', color: '#888',
    padding: '7px 10px', borderRadius: 7,
    cursor: 'pointer', fontSize: 12, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 8,
    textAlign: 'left' as const, width: '100%',
  },
  newBadge: {
    backgroundColor: '#1d4ed8', color: '#fff',
    fontSize: 10, fontWeight: 700, borderRadius: 10,
    padding: '1px 7px', marginLeft: 'auto',
  },
  divider: { height: 1, backgroundColor: '#1e2028', margin: '0 12px' },
  bucketList: { padding: '8px 8px 0', overflowY: 'auto' as const, flex: '1 1 auto' },
  sectionLabel: {
    fontSize: 10, color: '#444', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.8,
    padding: '4px 8px 8px',
  },
  bucketRow: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '7px 8px', borderRadius: 7,
    cursor: 'pointer', transition: 'background 0.1s',
    marginBottom: 1,
  },
  bucketDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  bucketName: { flex: 1, fontSize: 13, color: '#c0c0c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  bucketMeta: { display: 'flex', alignItems: 'center', gap: 5 },
  unreadDot: { width: 5, height: 5, borderRadius: '50%' },
  bucketCount: { fontSize: 11, color: '#555', minWidth: 16, textAlign: 'right' as const },
  removeBtn: {
    background: 'none', border: 'none', color: '#444',
    cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1,
    opacity: 0, transition: 'opacity 0.15s',
  },
  addSection: { padding: '10px 8px' },
  addRow: { display: 'flex', gap: 6 },
  bucketInput: {
    flex: 1, backgroundColor: '#1e2028', border: '1px solid #2a2d35',
    borderRadius: 6, padding: '6px 10px', color: '#f0f0f0',
    fontSize: 12, outline: 'none',
  },
  addConfirmBtn: {
    backgroundColor: '#1d4ed8', border: 'none', borderRadius: 6,
    color: '#fff', padding: '6px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 14,
  },
  addBucketBtn: {
    background: 'none', border: '1px dashed #2a2d35',
    borderRadius: 7, color: '#555', padding: '7px 10px',
    cursor: 'pointer', fontSize: 12, width: '100%', textAlign: 'left' as const,
  },
  spacer: { flex: '0 0 0' },
  footer: { padding: '12px 12px 16px', borderTop: '1px solid #1e2028', display: 'flex', flexDirection: 'column', gap: 8 },
  legendToggle: {
    background: 'none', border: 'none', color: '#555',
    fontSize: 11, cursor: 'pointer', padding: '2px 0',
    textAlign: 'left' as const, fontWeight: 600, letterSpacing: 0.2,
  },
  legend: { display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0 4px' },
  legendRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  legendDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  legendName: { fontSize: 11, color: '#aaa', fontWeight: 700, marginBottom: 1 },
  legendDesc: { fontSize: 10, color: '#555', lineHeight: 1.4 },
  memoryChip: { fontSize: 11, color: '#555', padding: '0 2px' },
  signOutBtn: {
    background: 'none', border: '1px solid #1e2028',
    borderRadius: 6, color: '#555', padding: '6px 10px',
    cursor: 'pointer', fontSize: 11, textAlign: 'center' as const,
  },
};

export default Sidebar;
