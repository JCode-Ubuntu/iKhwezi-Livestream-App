import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio, Users, ArrowLeft, RefreshCw, WifiOff, MessageCircle,
  Volume2, VolumeX, Gift, Crown, Send, X, Coins,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import UltimaField from '../ultima/UltimaField';
import ReactionsBar from '../components/ReactionsBar';
import GuestPrompt from '../components/GuestPrompt';
import { resolveStreamUrl } from '../config/appConfig';
import { useAnimatedInteger } from '../hooks/useAnimatedInteger';

const GIFT_ICONS = { rose: '🌹', gem: '💎', crown: '👑', star: '🌟' };

function FlyingReaction({ char }) {
  const left = 8 + Math.random() * 80;
  const drift = (Math.random() - 0.5) * 90;
  const size = 26 + Math.random() * 14;
  return (
    <span
      className="ik-flying-heart absolute"
      style={{ left: `${left}%`, fontSize: size, '--drift': `${drift}px` }}
    >
      {char}
    </span>
  );
}

function Live() {
  const navigate = useNavigate();
  const { fetchWithAuth, user, isGuest, trackGuestInteraction, showToast } = useAuth();
  const { socket, joinRoom, leaveRoom, sendChatMessage, sendReaction } = useSocket();
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const hlsRef = useRef(null);
  const activeHlsUrlRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const reactionTimersRef = useRef([]);
  const [liveStatus, setLiveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [touchY0, setTouchY0] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [muted, setMuted] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [giftCatalog, setGiftCatalog] = useState(null);
  const [sendingGift, setSendingGift] = useState(null);

  const HLS_URL = liveStatus?.hlsUrl
    ? resolveStreamUrl(liveStatus.hlsUrl)
    : resolveStreamUrl('/hls/stream.m3u8');

  const displayViewers = useAnimatedInteger(viewerCount, 450);

  useEffect(() => {
    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 5000);
    return () => {
      clearInterval(interval);
      reactionTimersRef.current.forEach(clearTimeout);
      reactionTimersRef.current = [];
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      activeHlsUrlRef.current = null;
      hasJoinedRef.current = false;
      leaveLive();
    };
  }, []);

  useEffect(() => {
    if (socket) {
      joinRoom('live-stream');

      socket.on('chat-message', (message) => {
        setChatMessages((prev) => [...prev.slice(-49), message]);
      });

      socket.on('reaction', (reaction) => {
        const rid = `${reaction.timestamp || Date.now()}-${Math.random()}`;
        setReactions((prev) => [...prev.slice(-11), { ...reaction, rid }]);
        const t1 = setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.rid !== rid));
        }, 3200);
        reactionTimersRef.current.push(t1);
      });

      socket.on('gift-received', (gift) => {
        const rid = `gift-${gift.timestamp || Date.now()}-${Math.random()}`;
        const burst = Math.min(6, Math.max(1, Math.round(gift.coins / 60)));
        for (let i = 0; i < burst; i += 1) {
          const tBurst = setTimeout(() => {
            const brid = `${rid}-${i}`;
            setReactions((prev) => [...prev.slice(-11), { reaction: gift.char, rid: brid }]);
            const tFade = setTimeout(() => setReactions((prev) => prev.filter((r) => r.rid !== brid)), 3200);
            reactionTimersRef.current.push(tFade);
          }, i * 120);
          reactionTimersRef.current.push(tBurst);
        }
        setChatMessages((prev) => [...prev.slice(-49), {
          id: rid,
          isGift: true,
          username: gift.fromUsername,
          message: `sent ${gift.char} ${gift.label} (${gift.coins} coins)`,
        }]);
      });

      return () => {
        socket.off('chat-message');
        socket.off('reaction');
        socket.off('gift-received');
        leaveRoom('live-stream');
      };
    }
  }, [socket]);

  useEffect(() => {
    if (!user || isGuest) return;
    fetchWithAuth('/wallet/me').then((r) => r.json()).then((data) => {
      setWallet(data.coins ?? 0);
      setGiftCatalog(data.giftCatalog || null);
    }).catch(() => {});
  }, [user, isGuest, fetchWithAuth]);

  const checkLiveStatus = async () => {
    try {
      const res = await fetchWithAuth('/live/status');
      const data = await res.json();
      setLiveStatus(data);
      setViewerCount(data.viewerCount || 0);

      if (data.isLive && videoRef.current) {
        const hlsUrl = data.hlsUrl
          ? resolveStreamUrl(data.hlsUrl)
          : resolveStreamUrl('/hls/stream.m3u8');
        if (activeHlsUrlRef.current !== hlsUrl) {
          activeHlsUrlRef.current = hlsUrl;
          hasJoinedRef.current = false;
          initHls(hlsUrl);
        }
      } else if (!data.isLive) {
        activeHlsUrlRef.current = null;
        hasJoinedRef.current = false;
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      }
    } catch (err) {
      console.error('Failed to check live status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = () => {
    if (chatInput.trim() && user) {
      sendChatMessage('live-stream', chatInput.trim(), user.id, user.username || user.displayName);
      setChatInput('');
    }
  };

  const handleReaction = (reaction) => {
    if (!user) {
      trackGuestInteraction();
      setShowUpgradePrompt(true);
      return;
    }
    sendReaction('live-stream', reaction, user.id, user.username || user.displayName);
  };

  const handleSendGift = async (giftId, gift) => {
    if (isGuest || !user) {
      trackGuestInteraction();
      setShowUpgradePrompt(true);
      return;
    }
    if (wallet !== null && wallet < gift.coins) {
      showToast?.(`Not enough coins — need ${gift.coins}, you have ${wallet}`, 'error');
      return;
    }
    setSendingGift(giftId);
    try {
      const res = await fetchWithAuth('/live/gift', {
        method: 'POST',
        body: JSON.stringify({ giftId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast?.(data.error || 'Failed to send gift', 'error');
        return;
      }
      setWallet(data.coinsRemaining);
      showToast?.(`${gift.char} Sent ${gift.label}!`, 'success');
      setShowGifts(false);
    } catch {
      showToast?.('Failed to send gift', 'error');
    } finally {
      setSendingGift(null);
    }
  };

  const initHls = async (url) => {
    if (!videoRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    const { default: Hls } = await import('hls.js');

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(url);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current.play().catch(() => {});
        if (!hasJoinedRef.current) {
          hasJoinedRef.current = true;
          joinLive();
        }
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
      videoRef.current.src = url;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current.play().catch(() => {});
        if (!hasJoinedRef.current) {
          hasJoinedRef.current = true;
          joinLive();
        }
      }, { once: true });
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

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
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
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
        <UltimaField intensity={0.8} fixed />
        <div className="ultima-content relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-black/40">
          <div className="h-14 w-14 animate-shimmer-slide rounded-full bg-gradient-to-r from-red-500/40 via-orange-400/30 to-red-500/40 bg-[length:200%_100%]" />
        </div>
        <p className="relative z-10 text-lg text-white/60">Checking live status…</p>
      </div>
    );
  }

  if (!liveStatus?.isLive) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-10 text-center">
        <UltimaField fixed />
        <div className="ultima-glass-supreme relative z-10 max-w-md rounded-[28px] px-8 py-10 text-center">
          <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 shadow-neon-ring">
            <WifiOff className="h-12 w-12 text-white/40" />
          </div>
          <h2 className="ultima-text-glow mb-2 font-display text-3xl font-black tracking-tight text-white">No Live Stream</h2>
          <p className="text-lg leading-relaxed text-white/65">
            The admin isn't broadcasting right now. Check back soon — or catch up on replays.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="ultima-btn-supreme mx-auto mt-6 flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm"
          >
            <RefreshCw size={18} />
            Check Again
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="ik-tap-spring mx-auto mt-3 flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white/70"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft size={18} />
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  const pulseGlow = Math.min(1, (viewerCount || 0) / 80 + displayViewers / 200);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black">
      <UltimaField intensity={0.25} fixed />

      <div className="ultima-content flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div
        className="relative z-20 flex items-center justify-between px-4"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: '0.5rem' }}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          className="ik-tap-spring flex h-10 w-10 items-center justify-center rounded-full text-white/75"
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)' }}
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

          <div className="ik-sparkle flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-semibold text-white shadow-glass backdrop-blur-xl">
            <Users size={14} />
            <span className="text-xs tabular-nums">{displayViewers}</span>
          </div>
        </div>
      </div>

      <div className="relative z-20 -mt-1 flex items-center gap-1.5 px-4 pb-2">
        <span className="ultima-glass-gold flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold-200">
          <Crown size={12} className="fill-gold-300 text-gold-300" />
          iKHWEZI · Admin
        </span>
      </div>

      {/* Video */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden bg-black"
        style={{ touchAction: 'manipulation', height: '56vw', minHeight: 200, maxHeight: '58vh' }}
        onWheel={onWheelZoom}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoom})` }}
          playsInline
          autoPlay
          muted={muted}
        />

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="ik-tap-spring absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white"
          style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)' }}
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {reactions.map((reaction) => (
            <FlyingReaction key={reaction.rid} char={reaction.reaction} />
          ))}
        </div>
      </div>

      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90">
          <WifiOff size={48} className="text-red-500" />
          <p className="text-white/70">{error}</p>
          <button type="button" onClick={handleRetry} className="ultima-btn-supreme rounded-2xl px-6 py-3 text-sm">
            <RefreshCw size={18} />
            Retry
          </button>
        </div>
      )}

      {/* Controls panel */}
      <div
        className="ultima-page ultima-page--flush flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-black/95 px-4 pt-3"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'var(--ultima-nav-offset)',
        }}
      >
        <div className="flex justify-center">
          <ReactionsBar
            engagement={(viewerCount || 0) * 3}
            variant="full"
            includeHeart
            className="max-w-full"
            onReaction={handleReaction}
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setShowChat(true)}
            className="ik-tap-spring flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white"
          >
            <MessageCircle size={14} />
            Chat
            {chatMessages.length > 0 && (
              <span className="rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-bold">{chatMessages.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowGifts(true)}
            className="ik-tap-spring flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-500/12 px-4 py-2 text-gold-200"
          >
            <Gift size={14} />
            Send Gift
          </button>
        </div>

        <div className="ultima-glass rounded-[20px] px-4 py-3">
          <h2 className="text-xl font-black tracking-tight text-white">
            {liveStatus.title || 'Live Stream'}
          </h2>
          <p className="mt-1 text-sm text-white/55">
            iKHWEZI Live •{' '}
            {liveStatus.startedAt ? new Date(liveStatus.startedAt).toLocaleTimeString() : 'recently'}
          </p>
        </div>
      </div>

      {/* Sliding chat panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-[120] flex flex-col rounded-t-[28px] border-t border-white/10 bg-black/90 backdrop-blur-2xl transition-transform duration-[380ms]"
        style={{
          height: '62vh',
          transform: showChat ? 'translateY(0)' : 'translateY(100%)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="font-display text-sm font-bold uppercase tracking-wider text-white/85">Live Chat</p>
          <button
            type="button"
            onClick={() => setShowChat(false)}
            className="ik-tap-spring flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Close chat"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {chatMessages.length === 0 && (
            <p className="mt-6 text-center text-sm text-white/35">Be the first to say something ✨</p>
          )}
          {chatMessages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={`mb-2.5 text-sm ${msg.isGift ? 'rounded-xl border border-gold-400/25 bg-gold-500/10 px-2.5 py-1.5' : ''}`}
            >
              <span className={`font-semibold ${msg.isGift ? 'text-gold-300' : 'text-pink-400'}`}>{msg.username}</span>{' '}
              <span className={msg.isGift ? 'text-gold-200/90' : 'text-white/90'}>{msg.isGift ? msg.message : `: ${msg.message}`}</span>
            </div>
          ))}
        </div>
        {user && (
          <div
            className="flex gap-2 border-t border-white/10 p-3"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Say something…"
              className="ultima-input flex-1 rounded-2xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={handleSendChat}
              aria-label="Send"
              className="ik-tap-spring flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-gold-500 text-white"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
      {showChat && (
        <div
          className="fixed inset-0 z-[110] bg-black/40"
          onClick={() => setShowChat(false)}
        />
      )}

      {/* Gift picker sheet */}
      {showGifts && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50" onClick={() => setShowGifts(false)}>
          <div
            className="ultima-glass-supreme w-full max-w-md rounded-t-[28px] p-5"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-sm font-bold uppercase tracking-widest text-gold-200">Send a Gift</p>
              <span className="ultima-glass-gold flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-gold-200">
                <Coins size={13} />
                {wallet ?? '–'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(giftCatalog || { rose: { coins: 10, char: '🌹', label: 'Rose' }, gem: { coins: 50, char: '💎', label: 'Gem' }, crown: { coins: 200, char: '👑', label: 'Crown' }, star: { coins: 500, char: '🌟', label: 'Supernova' } }).map(([id, gift]) => {
                const canAfford = wallet === null || wallet >= gift.coins;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSendGift(id, gift)}
                    disabled={sendingGift === id || !canAfford}
                    className={`ik-btn ik-btn-bouncy ultima-glass flex flex-col items-center gap-1.5 rounded-[20px] py-4 text-white ${!canAfford ? 'opacity-40' : ''}`}
                  >
                    <span className="text-3xl">{gift.char}</span>
                    <span className="text-[10px] font-semibold text-white/70">{gift.label}</span>
                    <span className="flex items-center gap-1 text-[9px] font-bold text-gold-300">
                      <Coins size={9} />
                      {gift.coins}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showUpgradePrompt && (
        <GuestPrompt
          onClose={() => setShowUpgradePrompt(false)}
          context="interaction"
        />
      )}
      </div>
    </div>
  );
}

export default Live;
