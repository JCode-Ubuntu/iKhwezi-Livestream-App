import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { NavVisibilityProvider } from './context/NavVisibilityContext';
import UltimaNav from './ultima/UltimaNav';
import Splash from './components/Splash';
import './design-tokens.css';
import UltimaLoading from './ultima/UltimaLoading';
import UltimaCreateSheet from './ultima/UltimaCreateSheet';
import VideoRecorder from './components/VideoRecorder';
import TextComposer from './components/TextComposer';
import StoryCreator from './components/StoryCreator';
import ImagePostCreator from './components/ImagePostCreator';
import CallOverlay from './components/CallOverlay';
import ErrorBoundary from './components/ErrorBoundary';

const Home = lazy(() => import('./pages/Home'));
const Live = lazy(() => import('./pages/Live'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
const Messages = lazy(() => import('./pages/Messages'));
const Explore = lazy(() => import('./pages/Explore'));
const Reels = lazy(() => import('./pages/Reels'));
const Community = lazy(() => import('./pages/Community'));

function App() {
  const isNative = Capacitor.isNativePlatform();
  const { loading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showTextComposer, setShowTextComposer] = useState(false);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [showImagePostCreator, setShowImagePostCreator] = useState(false);

  // Web gets the marketing splash; native keeps only the Capacitor splash
  // until auth finishes — avoids logo flash / double-splash freeze on Android.
  const [showSplash, setShowSplash] = useState(!isNative);

  useEffect(() => {
    if (isNative) return undefined;
    const t = setTimeout(() => setShowSplash(false), 1100);
    return () => clearTimeout(t);
  }, [isNative]);

  useEffect(() => {
    if (!isNative || loading || showSplash) return undefined;
    let cancelled = false;
    import('@capacitor/splash-screen').then(({ SplashScreen }) => {
      if (!cancelled) SplashScreen.hide().catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isNative, loading, showSplash]);

  if (loading) {
    return <UltimaLoading />;
  }

  if (showSplash) return <Splash showButtons={!user} />;

  return (
    <SocketProvider>
      <CallProvider>
      <NavVisibilityProvider>
      <div className="page-container">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<UltimaLoading />}>
            <div className="page-enter ultima-main">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/reels" element={<Reels />} />
                <Route path="/live" element={<Live />} />
                <Route path="/community" element={<Community />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/profile/:id" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </Suspense>
        </ErrorBoundary>

        <UltimaNav onCreateClick={() => setShowCreateSheet(true)} />

        {showCreateSheet && (
          <UltimaCreateSheet
            onClose={() => setShowCreateSheet(false)}
            onSignal={() => { setShowCreateSheet(false); setShowTextComposer(true); }}
            onVideo={() => { setShowCreateSheet(false); setShowVideoRecorder(true); }}
            onImage={() => { setShowCreateSheet(false); setShowImagePostCreator(true); }}
            onStory={() => { setShowCreateSheet(false); setShowStoryCreator(true); }}
            onGoLive={() => {
              setShowCreateSheet(false);
              if (user?.isAdmin) navigate('/admin', { state: { tab: 'streaming' } });
              else navigate('/live');
            }}
            onMessage={() => { setShowCreateSheet(false); navigate('/messages'); }}
          />
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
        {showImagePostCreator && (
          <ImagePostCreator
            onClose={() => setShowImagePostCreator(false)}
            onPosted={() => setShowImagePostCreator(false)}
          />
        )}
        {showStoryCreator && (
          <StoryCreator
            onClose={() => setShowStoryCreator(false)}
            onPosted={() => setShowStoryCreator(false)}
          />
        )}

        <CallOverlay />
      </div>
      </NavVisibilityProvider>
      </CallProvider>
    </SocketProvider>
  );
}

export default App;
