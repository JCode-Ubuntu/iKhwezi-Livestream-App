import React from 'react';

// React error boundaries only catch errors thrown during render (and in
// lifecycle/effect-adjacent code), not async callbacks or event handlers —
// this is a deliberate limitation of React itself, not a gap in this file.
// Without one anywhere in the app, ANY render-time exception (e.g. a typo'd
// or missing import, a null reference, a bad prop) unmounts the ENTIRE React
// tree, leaving the user with a blank white screen and no way to recover
// short of a full app restart. This happened for real: Reels.jsx and
// Explore.jsx both referenced `FullscreenFeed` without importing it, so
// opening either page threw `ReferenceError: FullscreenFeed is not defined`
// with nothing to catch it.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.handleReset)
          : this.props.fallback;
      }
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            height: '100%',
            minHeight: '50vh',
            padding: '24px',
            textAlign: 'center',
            color: '#fff',
          }}
        >
          <p style={{ fontSize: '1rem', opacity: 0.85 }}>Something went wrong loading this screen.</p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              borderRadius: '999px',
              border: 'none',
              background: '#fff',
              color: '#000',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
