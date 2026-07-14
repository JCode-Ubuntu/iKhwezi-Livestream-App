import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import './ultima/ultima.css';
import './styles/global.css';

async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#030014' });
  } catch {
    /* optional on web preview */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* optional */
  }
}

initNativeShell();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary fallback={(reset) => (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '16px', height: '100dvh', padding: '24px',
          textAlign: 'center', color: '#fff', background: '#030014',
        }}>
          <p style={{ fontSize: '1.05rem', opacity: 0.9 }}>iKhwezi ran into a problem and needs to reload.</p>
          <button
            type="button"
            onClick={() => { reset(); window.location.reload(); }}
            style={{ padding: '10px 22px', borderRadius: '999px', border: 'none', background: '#fff', color: '#000', fontWeight: 600 }}
          >
            Reload
          </button>
        </div>
      )}>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
