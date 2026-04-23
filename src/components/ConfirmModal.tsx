import React from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<Props> = ({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) => (
  <div style={styles.overlay} onClick={onCancel}>
    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
      <div style={styles.title}>{title}</div>
      <div style={styles.message}>{message}</div>
      <div style={styles.actions}>
        <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
        <button onClick={onConfirm} style={styles.confirmBtn}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, backdropFilter: 'blur(4px)',
  },
  modal: {
    backgroundColor: '#1a1b23', border: '1px solid #2a2d35',
    borderRadius: 14, padding: '28px 28px 24px',
    minWidth: 320, maxWidth: 400,
  },
  title: { fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 10 },
  message: { fontSize: 13, color: '#888', lineHeight: 1.5, marginBottom: 24 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    background: 'none', border: '1px solid #2a2d35',
    borderRadius: 8, color: '#888', padding: '8px 18px',
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
  },
  confirmBtn: {
    backgroundColor: '#ef4444', border: 'none',
    borderRadius: 8, color: '#fff', padding: '8px 18px',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};

export default ConfirmModal;
