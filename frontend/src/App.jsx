import React, { Suspense, lazy, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import UltimaNav from './ultima/UltimaNav';
import Splash from './components/Splash';
import './design-tokens.css';
import UltimaLoading from './ultima/UltimaLoading';
import UltimaCreateSheet from './ultima/UltimaCreateSheet';
import VideoRecorder from './components/VideoRecorder';
import TextComposer from './components/TextComposer';
import StoryCreator from './components/StoryCreator';
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
  const { loading, user } = useAuth();
  const location = useLocation();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showTextComposer, setShowTextComposer] = useState(false);
  const [showStoryCreator, setShowStoryCreator] = useState(false);

  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1100);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return <UltimaLoading />;
  }

  if (showSplash) return <Splash showButtons={!user} />;

  return (
    <SocketProvider>
      <CallProvider>
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
            onVideo={() => { setShowCreateSheet(false); setShowVideoRecorder(true); }}
            onStory={() => { setShowCreateSheet(false); setShowStoryCreator(true); }}
            onText={() => { setShowCreateSheet(false); setShowTextComposer(true); }}
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
        {showStoryCreator && (
          <StoryCreator
            onClose={() => setShowStoryCreator(false)}
            onPosted={() => setShowStoryCreator(false)}
          />
        )}

        <CallOverlay />
      </div>
      </CallProvider>
    </SocketProvider>
  );
}

export default App;
