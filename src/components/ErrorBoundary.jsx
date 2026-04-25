import React from 'react';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.logError(error, errorInfo);
  }

  logError(error, errorInfo) {
    const timestamp = new Date().toISOString();
    const errorData = {
      timestamp,
      message: error?.message || String(error),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    };
    try {
      const errors = JSON.parse(localStorage.getItem('intra-errors') || '[]');
      errors.unshift(errorData);
      if (errors.length > 50) errors.splice(50);
      localStorage.setItem('intra-errors', JSON.stringify(errors));
    } catch (e) {
      console.error('[ErrorBoundary] Failed to save error:', e);
    }
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container} className="fade-up">
          <div style={styles.icon}>💥</div>
          <div style={styles.title}>Что-то пошло не так</div>
          <div style={styles.desc}>Произошла непредвиденная ошибка приложения</div>
          <button style={styles.button} onClick={this.handleRestart}>
            <span style={styles.buttonText}>Перезапустить</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#ffffff',
    padding: 32,
    zIndex: 999999,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 300,
  },
  button: {
    background: '#2563eb',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 32,
    paddingRight: 32,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
};