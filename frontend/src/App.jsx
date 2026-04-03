import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navigation from './components/Navigation';

const Home = lazy(() => import('./pages/Home'));
const Live = lazy(() => import('./pages/Live'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));

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

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="page-container">
      <Suspense fallback={<LoadingScreen />}>
        <div className="page-enter flex min-h-0 flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/live" element={<Live />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Suspense>
      <Navigation />
    </div>
  );
}

export default App;
