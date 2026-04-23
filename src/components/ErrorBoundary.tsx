import React from 'react';

interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || 'Something went wrong.' };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={styles.screen}>
        <div style={styles.card}>
          <div style={styles.icon}>⚠️</div>
          <div style={styles.title}>Something went wrong</div>
          <div style={styles.msg}>{this.state.message}</div>
          <button style={styles.btn} onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    height: '100vh', backgroundColor: '#13141a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    backgroundColor: '#1a1b23', border: '1px solid #2a2d35',
    borderRadius: 16, padding: '44px 52px', textAlign: 'center', minWidth: 340,
  },
  icon: { fontSize: 36, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 800, color: '#f0f0f0', marginBottom: 8 },
  msg: { fontSize: 13, color: '#666', marginBottom: 24 },
  btn: {
    backgroundColor: '#1d4ed8', border: 'none', borderRadius: 8,
    color: '#fff', padding: '10px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
};
