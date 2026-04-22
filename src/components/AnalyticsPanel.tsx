import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ClassifiedEmail } from '../utils/classify';

interface Props {
  emails: ClassifiedEmail[];
  bucketColors: Record<string, string>;
  onClose: () => void;
}

function getTopSenders(emails: ClassifiedEmail[]): { name: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const e of emails) {
    if (!e.from) continue;
    const match = e.from.match(/^"?([^"<]+)"?\s*</);
    const name = (match ? match[1].trim() : e.from.replace(/<.*>/, '').trim()) || e.from;
    const key = name.split('@')[0].trim();
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
}

const AnalyticsPanel: React.FC<Props> = ({ emails, bucketColors, onClose }) => {
  const bucketCounts: Record<string, number> = {};
  emails.forEach((e) => { bucketCounts[e.bucket] = (bucketCounts[e.bucket] || 0) + 1; });

  const pieData = Object.entries(bucketCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const noiseCount = (bucketCounts['Newsletter'] || 0) + (bucketCounts['Auto-archive'] || 0) + (bucketCounts['Social'] || 0);
  const noisePercent = Math.round((noiseCount / emails.length) * 100);
  const importantCount = bucketCounts['Action Required'] || 0;
  const unreadCount = emails.filter((e) => e.unread).length;
  const topSenders = getTopSenders(emails);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const { name, value } = payload[0].payload;
      return (
        <div style={tooltipStyle}>
          <span style={{ color: bucketColors[name] || '#888' }}>{name}</span>
          <span style={{ color: '#f0f0f0', marginLeft: 8 }}>{value} ({Math.round((value / emails.length) * 100)}%)</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Inbox Analytics</span>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Stat cards */}
        <div style={styles.statRow}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statNum, color: '#ef4444' }}>{importantCount}</div>
            <div style={styles.statLabel}>Action Req.</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statNum, color: '#f59e0b' }}>{unreadCount}</div>
            <div style={styles.statLabel}>Unread</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statNum, color: '#6b7280' }}>{noisePercent}%</div>
            <div style={styles.statLabel}>Noise</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statNum, color: '#3b82f6' }}>{emails.length}</div>
            <div style={styles.statLabel}>Total</div>
          </div>
        </div>

        {/* Pie chart */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Inbox Breakdown</div>
          <div style={styles.chartRow}>
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={bucketColors[entry.name] || '#444'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={styles.legend}>
              {pieData.map((entry) => (
                <div key={entry.name} style={styles.legendRow}>
                  <span style={{ ...styles.legendDot, backgroundColor: bucketColors[entry.name] || '#444' }} />
                  <span style={styles.legendName}>{entry.name}</span>
                  <span style={styles.legendCount}>{entry.value}</span>
                  <span style={styles.legendPct}>{Math.round((entry.value / emails.length) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top senders */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Top Senders</div>
          <div style={styles.senderList}>
            {topSenders.map((s, i) => (
              <div key={s.name} style={styles.senderRow}>
                <span style={styles.senderRank}>{i + 1}</span>
                <span style={styles.senderName}>{s.name}</span>
                <div style={styles.senderBarWrap}>
                  <div style={{ ...styles.senderBar, width: `${(s.count / topSenders[0].count) * 100}%` }} />
                </div>
                <span style={styles.senderCount}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const tooltipStyle: React.CSSProperties = {
  backgroundColor: '#16181f',
  border: '1px solid #2a2d35',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 13,
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  panel: {
    backgroundColor: '#111318',
    border: '1px solid #2a2d35',
    borderRadius: 16,
    padding: 28,
    maxWidth: 620,
    width: '92%',
    maxHeight: '85vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: 800, color: '#f0f0f0' },
  closeBtn: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: '4px 8px' },
  statRow: { display: 'flex', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#16181f', borderRadius: 12,
    border: '1px solid #2a2d35', padding: '16px 12px', textAlign: 'center',
  },
  statNum: { fontSize: 28, fontWeight: 900, lineHeight: 1 },
  statLabel: { fontSize: 11, color: '#555', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 },
  section: {},
  sectionTitle: { fontSize: 12, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  chartRow: { display: 'flex', alignItems: 'center', gap: 16 },
  legend: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  legendRow: { display: 'flex', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  legendName: { flex: 1, fontSize: 13, color: '#c0c0c0' },
  legendCount: { fontSize: 13, color: '#888', width: 28, textAlign: 'right' },
  legendPct: { fontSize: 12, color: '#555', width: 36, textAlign: 'right' },
  senderList: { display: 'flex', flexDirection: 'column', gap: 8 },
  senderRow: { display: 'flex', alignItems: 'center', gap: 10 },
  senderRank: { fontSize: 12, color: '#444', width: 16, textAlign: 'right', flexShrink: 0 },
  senderName: { fontSize: 13, color: '#c0c0c0', width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  senderBarWrap: { flex: 1, height: 6, backgroundColor: '#1e2028', borderRadius: 3, overflow: 'hidden' },
  senderBar: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 3, transition: 'width 0.5s ease' },
  senderCount: { fontSize: 12, color: '#555', width: 24, textAlign: 'right', flexShrink: 0 },
};

export default AnalyticsPanel;
