import React, { Suspense, lazy, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navigation from './components/Navigation';
import VideoRecorder from './components/VideoRecorder';
import TextComposer from './components/TextComposer';

const Home = lazy(() => import('./pages/Home'));
const Live = lazy(() => import('./pages/Live'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
const Messages = lazy(() => import('./pages/Messages'));

function LoadingScreen() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-cosmic-950 bg-cosmic-gradient px-8">
      <div className="h-14 w-14 rounded-3xl border border-white/10 bg-black/30 shadow-glass backdrop-blur-xl">
        <div className="h-full w-full animate-shimmer-slide rounded-3xl bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent bg-[length:200%_100%]" />
      </div>
      <p className="text-sm font-medium tracking-wide text-white/50">Loading iKHWEZI…</p>
    </div>
  );
}

function App() {
  const { loading } = useAuth();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showTextComposer, setShowTextComposer] = useState(false);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <SocketProvider>
      <div className="page-container">
        <Suspense fallback={<LoadingScreen />}>
          <div className="page-enter flex min-h-0 flex-1 flex-col overflow-hidden">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/live" element={<Live />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Suspense>
        <Navigation onCreateClick={() => setShowCreateSheet(true)} />

        {/* Create type picker */}
        {showCreateSheet && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 999,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'flex-end',
            }}
            onClick={() => setShowCreateSheet(false)}
          >
            <div
              style={{
                width: '100%', background: '#0f0f1a',
                borderRadius: '20px 20px 0 0',
                padding: '24px 20px 40px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                width: 40, height: 4, borderRadius: 2,
                background: 'rgba(255,255,255,0.2)',
                margin: '0 auto 24px',
              }} />
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, textAlign: 'center' }}>
                Create
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => { setShowCreateSheet(false); setShowVideoRecorder(true); }}
                  style={{
                    flex: 1, padding: '18px 12px', borderRadius: 14,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 28 }}>🎬</span>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Video</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Upload a clip</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateSheet(false); setShowTextComposer(true); }}
                  style={{
                    flex: 1, padding: '18px 12px', borderRadius: 14,
                    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 28 }}>✍️</span>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Text Post</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Share your thoughts</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {showVideoRecorder && (
          <VideoRecorder
            onClose={() => setShowVideoRecorder(false)}
            onVideoUploaded={() => setShowVideoRecorder(false)}
          />
        )}
        {showTextComposer && (
          <TextComposer
            onClose={() => setShowTextComposer(false)}
            onPosted={() => setShowTextComposer(false)}
          />
        )}
      </div>
    </SocketProvider>
  );
}

export default App;
