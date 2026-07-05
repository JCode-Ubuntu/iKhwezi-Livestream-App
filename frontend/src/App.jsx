import React, { Suspense, lazy, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import UltimaNav from './ultima/UltimaNav';
import Splash from './components/Splash';
import './design-tokens.css';
import UltimaLoading from './ultima/UltimaLoading';
import UltimaCreateSheet from './ultima/UltimaCreateSheet';
import VideoRecorder from './components/VideoRecorder';
import TextComposer from './components/TextComposer';
import StoryCreator from './components/StoryCreator';

const Home = lazy(() => import('./pages/Home'));
const Live = lazy(() => import('./pages/Live'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
const Messages = lazy(() => import('./pages/Messages'));

function App() {
  const { loading } = useAuth();
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

  if (showSplash) return <Splash />;

  return (
    <SocketProvider>
      <div className="page-container">
        <Suspense fallback={<UltimaLoading />}>
          <div className="page-enter ultima-main">
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

        <UltimaNav onCreateClick={() => setShowCreateSheet(true)} />

        {showCreateSheet && (
          <UltimaCreateSheet
            onClose={() => setShowCreateSheet(false)}
            onVideo={() => setShowVideoRecorder(true)}
            onStory={() => setShowStoryCreator(true)}
            onText={() => setShowTextComposer(true)}
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
      </div>
    </SocketProvider>
  );
}

export default App;
