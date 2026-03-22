import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { Radio, Users, ArrowLeft, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Live() {
  const navigate = useNavigate();
  const { fetchWithAuth } = useAuth();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);

  const HLS_URL = 'http://localhost:8080/hls/stream.m3u8';

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

  if (loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        paddingBottom: 70,
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}>
          <Radio size={36} color="white" />
        </div>
        <p style={{ color: '#A0A0A0', fontSize: 16 }}>Checking live status...</p>
      </div>
    );
  }

  if (!liveStatus?.isLive) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 40,
        paddingBottom: 110,
        textAlign: 'center',
      }}>
        <div style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1E2235, #252A40)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '3px solid #252A40',
        }}>
          <WifiOff size={48} color="#6B7280" />
        </div>
        
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            No Live Stream
          </h2>
          <p style={{ color: '#A0A0A0', maxWidth: 280, lineHeight: 1.6 }}>
            The creator is not currently streaming. Check back soon for live content!
          </p>
        </div>

        <button
          onClick={handleRetry}
          className="btn btn-primary"
          style={{ marginTop: 8 }}
        >
          <RefreshCw size={18} />
          Check Again
        </button>

        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost"
        >
          <ArrowLeft size={18} />
          Back to Feed
        </button>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
      marginBottom: 70,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: '#EF4444',
            borderRadius: 20,
            animation: 'live-pulse 1.5s ease-in-out infinite',
          }}>
            <Radio size={14} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>LIVE</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 20,
          }}>
            <Users size={14} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>{viewerCount}</span>
          </div>
        </div>
      </div>

      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: '#000',
        }}
        playsInline
        controls
        autoPlay
        muted
      />

      {error && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: 'rgba(0, 0, 0, 0.9)',
        }}>
          <WifiOff size={48} color="#EF4444" />
          <p style={{ color: '#A0A0A0' }}>{error}</p>
          <button onClick={handleRetry} className="btn btn-primary">
            <RefreshCw size={18} />
            Retry
          </button>
        </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '60px 20px 20px',
        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent)',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          {liveStatus.title || 'Live Stream'}
        </h2>
        <p style={{ color: '#A0A0A0', fontSize: 14 }}>
          iKHWEZI Live • Started {liveStatus.startedAt ? new Date(liveStatus.startedAt).toLocaleTimeString() : 'recently'}
        </p>
      </div>
    </div>
  );
}

export default Live;
