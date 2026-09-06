import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { NavVisibilityProvider, useNavVisibility } from './context/NavVisibilityContext';
import { CreateFlowProvider } from './context/CreateFlowContext';
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
import GuestPrompt from './components/GuestPrompt';

// CREATE → Group / Message / Meeting flows. Lazy: they pull in the messaging
// components which most sessions never open.
const CreateGroupWizard = lazy(() => import('./components/groups/CreateGroupWizard'));
const NewConversationModal = lazy(() => import('./components/messages/NewConversationModal'));
const CreateMeetingSheet = lazy(() => import('./components/meetings/CreateMeetingSheet'));

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

/**
 * AppShell owns the CREATE hub. Every creation / initiation flow in the app is
 * mounted here exactly once and reached through the CREATE sheet (or through
 * `useCreateFlow().openCreate(action)` from a contextual button). Pages do not
 * mount their own composers.
 */
function AppShell() {
  const { user, isGuest, trackGuestInteraction } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setDockForcedHidden } = useNavVisibility();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  // `active` is the single open CREATE flow: null | 'signal' | 'video' | 'image'
  // | 'story' | 'group' | 'message' | 'meeting'. One at a time, by design.
  const [active, setActive] = useState(null);
  const [activeOptions, setActiveOptions] = useState({});
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  const createFlowOpen = showCreateSheet || active !== null;
  const isLiveRoute = location.pathname === '/live';

  useEffect(() => {
    setDockForcedHidden(createFlowOpen || isLiveRoute);
    return () => setDockForcedHidden(false);
  }, [createFlowOpen, isLiveRoute, setDockForcedHidden]);

  const close = useCallback(() => { setActive(null); setActiveOptions({}); }, []);

  const openCreateSheet = useCallback(() => {
    if (isGuest) { trackGuestInteraction?.(); setShowGuestPrompt(true); return; }
    setShowCreateSheet(true);
  }, [isGuest, trackGuestInteraction]);

  const goLive = useCallback(() => {
    // Production live is a single operator broadcast (OBS → RTMP → HLS).
    // Operators land on the streaming console; everyone else joins as a viewer.
    // Phase 3A: role is authoritative (RBAC); isAdmin kept as the transition
    // projection for older sessions issued before the role column existed.
    const isOperator = user?.role === 'admin' || ((user?.role == null || user?.role === 'user') && user?.isAdmin);
    if (isOperator) navigate('/admin', { state: { tab: 'streaming' } });
    else navigate('/live');
  }, [user?.role, user?.isAdmin, navigate]);

  /** Open one hub action directly (used by the sheet and by contextual buttons). */
  const openCreate = useCallback((action, options = {}) => {
    setShowCreateSheet(false);
    if (isGuest) { trackGuestInteraction?.(); setShowGuestPrompt(true); return; }
    if (action === 'live') { goLive(); return; }
    setActiveOptions(options || {});
    setActive(action);
  }, [isGuest, trackGuestInteraction, goLive]);

  // Hand-offs into Messages after a successful Group / Message / Meeting action.
  const openGroupInMessages = useCallback((groupId, extra = {}) => {
    close();
    navigate('/messages', { state: { openGroupId: groupId, ...extra } });
  }, [close, navigate]);

  const openDmInMessages = useCallback((otherUser) => {
    close();
    navigate('/messages', { state: { openUser: otherUser } });
  }, [close, navigate]);

  return (
    <CreateFlowProvider openCreateSheet={openCreateSheet} openCreate={openCreate}>
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

      <UltimaNav onCreateClick={openCreateSheet} />

      {showCreateSheet && (
        <UltimaCreateSheet
          onClose={() => setShowCreateSheet(false)}
          canBroadcast={!!user?.isAdmin}
          onSignal={() => openCreate('signal')}
          onVideo={() => openCreate('video')}
          onImage={() => openCreate('image')}
          onStory={() => openCreate('story')}
          onGroup={() => openCreate('group')}
          onMessage={() => openCreate('message')}
          onGoLive={() => openCreate('live')}
          onMeeting={() => openCreate('meeting')}
        />
      )}

      {showGuestPrompt && (
        <GuestPrompt onClose={() => setShowGuestPrompt(false)} context="create" />
      )}

      {/* ---- CREATE flows (existing components, mounted once) ---- */}
      {active === 'video' && (
        <VideoRecorder onClose={close} onVideoUploaded={close} />
      )}
      {active === 'signal' && (
        <TextComposer onClose={close} onPosted={close} />
      )}
      {active === 'image' && (
        <ImagePostCreator onClose={close} onPosted={close} />
      )}
      {active === 'story' && (
        <StoryCreator onClose={close} onPosted={close} />
      )}

      <Suspense fallback={active ? <UltimaLoading /> : null}>
        {active === 'group' && (
          <CreateGroupWizard
            onClose={close}
            onCreated={(group) => openGroupInMessages(group.id)}
          />
        )}
        {active === 'message' && (
          <NewConversationModal
            onClose={close}
            onSelect={openDmInMessages}
          />
        )}
        {active === 'meeting' && (
          <CreateMeetingSheet
            onClose={close}
            preselectedGroupId={activeOptions.groupId || null}
            onNeedGroup={() => openCreate('group')}
            onCreated={(meeting) => openGroupInMessages(meeting.groupId, { openMeetingId: meeting.id })}
          />
        )}
      </Suspense>

      <CallOverlay />
    </div>
    </CreateFlowProvider>
  );
}

function App() {
  const isNative = Capacitor.isNativePlatform();
  const { loading, user } = useAuth();
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
    // Push: init FCM and (when a session exists) hand the token to the
    // server device registry (Phase 3A). Later token/server syncs run from
    // AuthContext on login/register/logout.
    import('./native/pushNotifications').then(async (mod) => {
      if (cancelled) return;
      await mod.initPushNotifications().catch(() => {});
      if (mod.syncPushTokenOnAuth) mod.syncPushTokenOnAuth().catch(() => {});
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
          <AppShell />
        </NavVisibilityProvider>
      </CallProvider>
    </SocketProvider>
  );
}

export default App;
