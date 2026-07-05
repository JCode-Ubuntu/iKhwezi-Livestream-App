import React, { Suspense, lazy, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navigation from './components/Navigation';
import VideoRecorder from './components/VideoRecorder';
import TextComposer from './components/TextComposer';
import StoryCreator from './components/StoryCreator';
import { X } from 'lucide-react';

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
  const [showStoryCreator, setShowStoryCreator] = useState(false);

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
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'flex-end',
            }}
            onClick={() => setShowCreateSheet(false)}
          >
            <div
              style={{
                width: '100%', background: '#0f0f1a',
                borderRadius: '20px 20px 0 0',
                paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Sheet header with back/close button */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}>
                <button
                  type="button"
                  onClick={() => setShowCreateSheet(false)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
                    flexShrink: 0,
                  }}
                  aria-label="Close"
                >
                  <X size={17} />
                </button>
                <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Create</span>
                <div style={{ width: 36 }} />
              </div>

              <div style={{ display: 'flex', gap: 12, padding: '20px 16px' }}>
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
                  onClick={() => { setShowCreateSheet(false); setShowStoryCreator(true); }}
                  style={{
                    flex: 1, padding: '18px 12px', borderRadius: 14,
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 28 }}>✨</span>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Story</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>24h moment</span>
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
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Share thoughts</span>
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
        {showStoryCreator && (
          <StoryCreator
            onClose={() => setShowStoryCreator(false)}
            onPosted={() => setShowStoryCreator(false)}
          />
        )}
      </div>
    </SocketProvider>
  );
}

export default App;
