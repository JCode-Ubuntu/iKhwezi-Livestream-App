import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { Radio, Users, ArrowLeft, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CosmicBackground from '../components/CosmicBackground';
import ReactionsBar from '../components/ReactionsBar';
import GlassCard from '../components/GlassCard';
import { useAnimatedInteger } from '../hooks/useAnimatedInteger';

function Live() {
  const navigate = useNavigate();
  const { fetchWithAuth } = useAuth();
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const hlsRef = useRef(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [touchY0, setTouchY0] = useState(null);

  const HLS_URL = `${window.location.origin}/hls/stream.m3u8`;

  const displayViewers = useAnimatedInteger(viewerCount, 450);

  useEffect(() => {
    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 5000);
    return () => {
      clearInterval(interval);
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      leaveLive();
    };
  }, []);

  const checkLiveStatus = async () => {
    try {
      const res = await fetchWithAuth('/live/status');
      const data = await res.json();
      setLiveStatus(data);
      setViewerCount(data.viewerCount || 0);
      
      if (data.isLive && videoRef.current) {
        initHls();
      }
    } catch (err) {
      console.error('Failed to check live status:', err);
    } finally {
      setLoading(false);
    }
  };

  const initHls = () => {
    if (!videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(HLS_URL);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current.play().catch(() => {});
        joinLive();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Stream not available');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('Stream error occurred');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = HLS_URL;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current.play().catch(() => {});
        joinLive();
      });
    }
  };

  const joinLive = async () => {
    try {
      const res = await fetchWithAuth('/live/join', { method: 'POST' });
      const data = await res.json();
      setViewerCount(data.viewerCount);
    } catch (err) {
      console.error('Failed to join live:', err);
    }
  };

  const leaveLive = async () => {
    try {
      await fetchWithAuth('/live/leave', { method: 'POST' });
    } catch (err) {
      console.error('Failed to leave live:', err);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    checkLiveStatus();
  };

  const onWheelZoom = useCallback((e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(1.5, Math.max(1, z + (e.deltaY > 0 ? -0.06 : 0.06))));
  }, []);

  const onTouchStart = (e) => {
    setTouchY0(e.touches[0].clientY);
  };

  const onTouchEnd = (e) => {
    if (touchY0 == null) return;
    const y = e.changedTouches[0].clientY;
    const dy = touchY0 - y;
    setTouchY0(null);
    if (dy > 70) {
      if (navigator.vibrate) try { navigator.vibrate(8); } catch { /* ignore */ }
    }
  };

  if (loading) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 pb-[70px]">
        <CosmicBackground intensity={0.8} />
        <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-black/40 shadow-glass backdrop-blur-xl">
          <div className="h-14 w-14 animate-shimmer-slide rounded-full bg-gradient-to-r from-red-500/40 via-orange-400/30 to-red-500/40 bg-[length:200%_100%]" />
        </div>
        <p className="relative z-10 text-lg text-white/60">Checking live status…</p>
      </div>
    );
  }

  if (!liveStatus?.isLive) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-10 pb-[110px] text-center">
        <CosmicBackground />
        <GlassCard className="relative z-10 max-w-md px-8 py-10 text-center" neon="medium">
          <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 shadow-neon-ring">
            <WifiOff className="h-12 w-12 text-white/40" />
          </div>
          <h2 className="mb-2 text-3xl font-black tracking-tight text-glow-neon">No Live Stream</h2>
          <p className="text-lg leading-relaxed text-white/65">
            The creator is not currently streaming. Check back soon for live content!
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="btn btn-primary mx-auto mt-6"
          >
            <RefreshCw size={18} />
            Check Again
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-ghost mx-auto mt-3 w-full max-w-xs"
          >
            <ArrowLeft size={18} />
            Back to Feed
          </button>
        </GlassCard>
      </div>
    );
  }

  const pulseGlow = Math.min(1, (viewerCount || 0) / 80 + displayViewers / 200);

  return (
    <div className="relative mb-[70px] flex min-h-0 flex-1 flex-col bg-black">
      <CosmicBackground intensity={0.25} />

      <div
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-4"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white shadow-glass backdrop-blur-xl transition-transform active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-600/90 px-3 py-1.5 shadow-[0_0_24px_rgba(239,68,68,0.45)] animate-live-ring"
            style={{
              boxShadow: `0 0 ${16 + pulseGlow * 24}px rgba(239, 68, 68, ${0.35 + pulseGlow * 0.2})`,
            }}
          >
            <Radio size={14} className="text-white" />
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-semibold text-white shadow-glass backdrop-blur-xl">
            <Users size={14} />
            <span className="text-xs tabular-nums">{displayViewers}</span>
          </div>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        onWheel={onWheelZoom}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'manipulation' }}
      >
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoom})` }}
          playsInline
          controls
          autoPlay
          muted
        />
      </div>

      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90">
          <WifiOff size={48} className="text-red-500" />
          <p className="text-white/70">{error}</p>
          <button type="button" onClick={handleRetry} className="btn btn-primary">
            <RefreshCw size={18} />
            Retry
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-3 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-8 pt-24">
        <div className="pointer-events-auto flex justify-center pb-2">
          <ReactionsBar
            engagement={(viewerCount || 0) * 3}
            variant="full"
            includeHeart
            className="max-w-full"
          />
        </div>
        <GlassCard className="pointer-events-auto border-white/10 !bg-black/45 px-4 py-3" neon="low">
          <h2 className="text-xl font-black tracking-tight text-white">
            {liveStatus.title || 'Live Stream'}
          </h2>
          <p className="mt-1 text-sm text-white/55">
            iKHWEZI Live •{' '}
            {liveStatus.startedAt ? new Date(liveStatus.startedAt).toLocaleTimeString() : 'recently'}
          </p>
          <p className="mt-2 text-xs text-white/40">
            Pinch or Ctrl+scroll to zoom the stream. Swipe up for quick reactions.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

export default Live;
