import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from '../components/VideoPlayer';
import VideoActions from '../components/VideoActions';
import Comments from '../components/Comments';
import GuestPrompt from '../components/GuestPrompt';
import CosmicBackground from '../components/CosmicBackground';
import SkeletonStream from '../components/SkeletonStream';
import ReactionsBar from '../components/ReactionsBar';
import { Volume2, VolumeX, Sparkles, Play, Flame, TrendingUp } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Hero Carousel — top trending / sponsored videos
───────────────────────────────────────────────────────── */
function HeroCarousel({ videos, onOpen, muted }) {
  const [heroIndex, setHeroIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (videos.length < 2) return;
    intervalRef.current = setInterval(() => setHeroIndex(i => (i + 1) % videos.length), 4500);
    return () => clearInterval(intervalRef.current);
  }, [videos.length]);

  if (!videos.length) return null;
  const v = videos[heroIndex];

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ height: '50vh', minHeight: 220 }}>
      {/* Background video preview */}
      <video
        key={v.id}
        src={`/storage/uploads/${v.filename}`}
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
        autoPlay
        muted
        loop
        playsInline
        style={{ filter: 'brightness(0.55)' }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

      {/* Badges */}
      <div className="absolute left-4 top-4 flex gap-2">
        {v.isTrending && (
          <span className="flex items-center gap-1 rounded-full bg-orange-500/90 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            <Flame size={10} /> Trending
          </span>
        )}
        {v.isSponsored && (
          <span className="flex items-center gap-1 rounded-full bg-yellow-400/90 px-3 py-1 text-[11px] font-bold text-black backdrop-blur-sm">
            Sponsored
          </span>
        )}
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold text-white/60">@{v.creator?.username || 'unknown'}</p>
            {v.caption && (
              <h2 className="line-clamp-2 text-lg font-black leading-tight text-white drop-shadow-lg">
                {v.caption}
              </h2>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-white/50">
              <span>❤️ {v.likeCount || 0}</span>
              <span>💬 {v.commentCount || 0}</span>
              <span>👁 {v.views || 0}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpen(heroIndex)}
            className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 border border-white/20 backdrop-blur-xl transition-transform active:scale-95"
          >
            <Play size={20} fill="white" className="text-white ml-0.5" />
          </button>
        </div>

        {/* Dot indicators */}
        <div className="mt-3 flex justify-center gap-1.5">
          {videos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setHeroIndex(i)}
              className="transition-all duration-300"
              style={{
                width: i === heroIndex ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === heroIndex ? 'linear-gradient(90deg,#6F4FFF,#FFB800)' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Video Grid Thumbnail
───────────────────────────────────────────────────────── */
function GridThumb({ video, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl bg-slate-900 active:scale-95 transition-transform"
      style={{ aspectRatio: '9/16' }}
    >
      <video
        src={`/storage/uploads/${video.filename}`}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {/* Always-visible bottom info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-2">
        <p className="truncate text-[10px] font-semibold text-white/80">@{video.creator?.username}</p>
        <div className="flex items-center gap-2 text-[9px] text-white/50 mt-0.5">
          <span>❤ {video.likeCount || 0}</span>
          <span>▶ {video.views || 0}</span>
        </div>
      </div>
      {video.isTrending && (
        <div className="absolute left-1.5 top-1.5 rounded-full bg-orange-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
          🔥
        </div>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────
   Full-screen video player overlay
───────────────────────────────────────────────────────── */
function FullscreenFeed({ videos, startIndex, onClose, muted, setMuted, onUpdate, showGuestPrompt }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);

  const currentVideo = videos[currentIndex];

  const go = (dir) => {
    setCurrentIndex(i => {
      const next = i + dir;
      if (next < 0 || next >= videos.length) return i;
      return next;
    });
  };

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e) => {
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) go(dy > 0 ? 1 : -1);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowUp') go(-1);
      if (e.key === 'ArrowDown') go(1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl"
        style={{ paddingTop: 'max(0px,env(safe-area-inset-top))' }}
      >
        ✕
      </button>
      {/* Mute */}
      <button
        type="button"
        onClick={() => setMuted(m => !m)}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl"
        style={{ paddingTop: 'max(0px,env(safe-area-inset-top))' }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <div
        ref={containerRef}
        className="h-full"
        style={{ transform: `translateY(-${currentIndex * 100}%)`, transition: 'transform 0.35s cubic-bezier(0.25,0.1,0.25,1)' }}
      >
        {videos.map((video, index) => (
          <div key={video.id} className="relative h-screen w-full">
            <VideoPlayer src={`/storage/uploads/${video.filename}`} isActive={index === currentIndex} />
            <VideoActions
              video={video}
              onUpdate={onUpdate}
              onShowComments={showGuestPrompt}
              onShowLogin={showGuestPrompt}
            />
            <div className="pointer-events-none absolute bottom-24 left-4 z-10" style={{ right: '5.5rem' }}>
              <div className="flex items-center gap-2.5">
                <div className="avatar border border-white/20" style={{ width: 36, height: 36 }}>
                  {video.creator?.username?.charAt(0).toUpperCase() || '?'}
                </div>
                <p className="font-bold text-sm text-white drop-shadow">@{video.creator?.username || 'unknown'}</p>
              </div>
              {video.caption && (
                <p className="mt-2 text-sm text-white/90 drop-shadow line-clamp-3">{video.caption}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Nav arrows */}
      {currentIndex > 0 && (
        <button type="button" onClick={() => go(-1)} className="absolute left-1/2 top-16 -translate-x-1/2 z-10 text-white/50 text-2xl">▲</button>
      )}
      {currentIndex < videos.length - 1 && (
        <button type="button" onClick={() => go(1)} className="absolute left-1/2 bottom-24 -translate-x-1/2 z-10 text-white/50 text-2xl">▼</button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Home page
───────────────────────────────────────────────────────── */
function Home() {
  const { fetchWithAuth, isGuest, guestInteractions, trackGuestInteraction } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestPromptContext, setGuestPromptContext] = useState('default');
  const [muted, setMuted] = useState(true);
  const [fullscreenIndex, setFullscreenIndex] = useState(null);
  const loadingMore = useRef(false);

  useEffect(() => {
    if (isGuest && guestInteractions >= 3 && !showGuestPrompt) {
      setGuestPromptContext('interaction');
      setShowGuestPrompt(true);
    }
  }, [guestInteractions, isGuest, showGuestPrompt]);

  const loadVideos = useCallback(async (pageNum = 1, append = false) => {
    if (loadingMore.current) return;
    loadingMore.current = true;
    try {
      const res = await fetchWithAuth(`/videos/feed?page=${pageNum}&limit=20`);
      const data = await res.json();
      if (append) {
        setVideos(prev => [...prev, ...data.videos]);
      } else {
        setVideos(data.videos);
      }
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Failed to load videos:', err);
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const updateVideo = useCallback((updatedVideo) => {
    setVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
  }, []);

  const handleShowGuestPrompt = () => {
    trackGuestInteraction();
    setGuestPromptContext('interaction');
    setShowGuestPrompt(true);
  };

  const heroVideos = useMemo(() => {
    const trending = videos.filter(v => v.isTrending || v.isSponsored);
    return (trending.length >= 3 ? trending : videos).slice(0, 8);
  }, [videos]);

  const gridVideos = useMemo(() => {
    const heroIds = new Set(heroVideos.map(v => v.id));
    return videos.filter(v => !heroIds.has(v.id));
  }, [videos, heroVideos]);

  // Infinite scroll
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const next = page + 1;
        setPage(next);
        loadVideos(next, true);
      }
    }, { rootMargin: '200px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, loadVideos]);

  if (loading && videos.length === 0) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-[70px]">
        <CosmicBackground intensity={1.2} />
        <SkeletonStream rows={4} />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-10 pb-[110px] text-center">
        <CosmicBackground />
        <div className="glass-panel relative z-10 flex max-w-sm flex-col items-center gap-4 px-8 py-10">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-neon-indigo/30 to-neon-purple/20 shadow-neon-ring">
            <Sparkles className="h-11 w-11 text-neon-cyan" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-glow-neon">No Videos Yet</h2>
          <p className="text-lg leading-relaxed text-white/70">Be the first to share amazing content on iKHWEZI!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] pb-[70px]">
      <CosmicBackground intensity={0.2} />

      {/* ── Hero Carousel ── */}
      <HeroCarousel
        videos={heroVideos}
        muted={muted}
        onOpen={(i) => setFullscreenIndex(i)}
      />

      {/* ── Grid Section Header ── */}
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-neon-cyan" />
          <span className="text-sm font-bold uppercase tracking-wider text-white/80">Latest</span>
        </div>
        <span className="text-xs text-white/30">{gridVideos.length} videos</span>
      </div>

      {/* ── 4-Column Grid ── */}
      <div className="grid grid-cols-4 gap-1 px-1" style={{ gridAutoRows: 'auto' }}>
        {gridVideos.map((video, index) => (
          <GridThumb
            key={video.id}
            video={video}
            onClick={() => setFullscreenIndex(heroVideos.length + index)}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-10 w-full" />
      {loading && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neon-indigo border-t-transparent" />
        </div>
      )}

      {/* ── Fullscreen player overlay ── */}
      {fullscreenIndex !== null && (
        <FullscreenFeed
          videos={videos}
          startIndex={fullscreenIndex}
          onClose={() => setFullscreenIndex(null)}
          muted={muted}
          setMuted={setMuted}
          onUpdate={updateVideo}
          showGuestPrompt={handleShowGuestPrompt}
        />
      )}

      {showComments && videos[fullscreenIndex] && (
        <Comments
          videoId={videos[fullscreenIndex].id}
          onClose={() => setShowComments(false)}
        />
      )}

      {showGuestPrompt && (
        <GuestPrompt onClose={() => setShowGuestPrompt(false)} context={guestPromptContext} />
      )}
    </div>
  );
}

export default Home;


function Home() {
  const { fetchWithAuth, isGuest, guestInteractions, trackGuestInteraction } = useAuth();
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestPromptContext, setGuestPromptContext] = useState('default');
  const [muted, setMuted] = useState(true);
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Show prompt after 3 guest interactions
  useEffect(() => {
    if (isGuest && guestInteractions >= 3 && !showGuestPrompt) {
      setGuestPromptContext('interaction');
      setShowGuestPrompt(true);
    }
  }, [guestInteractions, isGuest, showGuestPrompt]);

  const loadVideos = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await fetchWithAuth(`/videos/feed?page=${pageNum}&limit=10`);
      const data = await res.json();
      
      if (append) {
        setVideos(prev => [...prev, ...data.videos]);
      } else {
        setVideos(data.videos);
      }
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Failed to load videos:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    if (currentIndex >= videos.length - 3 && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadVideos(nextPage, true);
    }
  }, [currentIndex, videos.length, hasMore, loading, page, loadVideos]);

  const goToVideo = useCallback((index) => {
    if (index >= 0 && index < videos.length) {
      setCurrentIndex(index);
    }
  }, [videos.length]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentIndex < videos.length - 1) {
        goToVideo(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        goToVideo(currentIndex - 1);
      }
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight' && currentIndex < videos.length - 1) {
      goToVideo(currentIndex + 1);
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      goToVideo(currentIndex - 1);
    }
  }, [currentIndex, videos.length, goToVideo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const updateVideo = useCallback((updatedVideo) => {
    setVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
  }, []);

  // Track guest interactions and show prompt
  const handleShowGuestPrompt = () => {
    trackGuestInteraction();
    setGuestPromptContext('interaction');
    setShowGuestPrompt(true);
  };

  const currentVideo = videos[currentIndex];

  const fashionMood = useMemo(() => {
    const t = `${currentVideo?.title || ''} ${currentVideo?.description || ''}`;
    return /fashion|style|outfit|runway|couture/i.test(t) ? 'fashion' : 'default';
  }, [currentVideo]);

  const engagementPulse = useMemo(() => {
    if (!currentVideo) return 0;
    return (currentVideo.likeCount || 0) + (currentVideo.commentCount || 0) * 2 + (currentVideo.starCount || 0);
  }, [currentVideo]);

  if (loading && videos.length === 0) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-[70px]">
        <CosmicBackground intensity={1.2} />
        <SkeletonStream rows={4} />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-10 pb-[110px] text-center">
        <CosmicBackground />
        <div className="glass-panel relative z-10 flex max-w-sm flex-col items-center gap-4 px-8 py-10">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-neon-indigo/30 to-neon-purple/20 shadow-neon-ring">
            <Sparkles className="h-11 w-11 text-neon-cyan" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-glow-neon">No Videos Yet</h2>
          <p className="text-lg leading-relaxed text-white/70">
            Be the first to share amazing content on iKHWEZI!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative mb-[70px] min-h-0 flex-1 overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <CosmicBackground intensity={0.35} />
      <FeedDiscovery
        videos={videos}
        currentIndex={currentIndex}
        onPickIndex={goToVideo}
        fashionTag={fashionMood}
      />

      <div
        className="absolute inset-0 z-[1] flex"
        style={{
          transition: 'transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
          transform: `translateX(-${currentIndex * 100}%)`,
        }}
      >
        {videos.map((video, index) => (
          <div
            key={video.id}
            className="relative h-full min-w-full"
          >
            <VideoPlayer
              src={`/storage/uploads/${video.filename}`}
              isActive={index === currentIndex}
            />
            
            <VideoActions
              video={video}
              onUpdate={updateVideo}
              onShowComments={() => setShowComments(true)}
              onShowLogin={handleShowGuestPrompt}
            />

            <div
              className="pointer-events-none absolute bottom-24 left-4 z-10 md:bottom-32"
              style={{ right: '5.5rem' }}
            >
              <div className="pointer-events-auto mb-3 max-w-[min(70vw,18rem)]">
                <ReactionsBar
                  variant="compact"
                  includeHeart={false}
                  engagement={engagementPulse}
                  className="inline-block"
                />
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className="avatar border border-white/20 shadow-[0_0_24px_rgba(99,102,241,0.35)]"
                  style={{
                    width: 40,
                    height: 40,
                  }}
                >
                  {video.creator?.avatar ? (
                    <img src={video.creator.avatar} alt="" />
                  ) : (
                    video.creator?.username?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div>
                  <p style={{
                    fontWeight: 700,
                    fontSize: 15,
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                  }}>
                    @{video.creator?.username || 'unknown'}
                  </p>
                  {video.isSponsored && (
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      background: 'linear-gradient(135deg, #FFB800, #CC9200)',
                      borderRadius: 4,
                      color: '#000',
                      fontWeight: 600,
                    }}>
                      Sponsored
                    </span>
                  )}
                </div>
              </div>
              
              {video.title && (
                <h3 style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 6,
                  marginTop: 12,
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {video.title}
                </h3>
              )}
              
              {video.description && (
                <p style={{
                  fontSize: 13,
                  color: '#D0D0D0',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {video.description}
                </p>
              )}
            </div>

            {video.isTrending && (
              <div style={{
                position: 'absolute',
                top: 16,
                left: 16,
                padding: '6px 12px',
                background: 'linear-gradient(135deg, #FFB800, #CC9200)',
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                zIndex: 10,
              }}>
                <Sparkles size={14} color="#000" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#000' }}>
                  Trending
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setMuted(!muted)}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white shadow-glass backdrop-blur-xl transition-transform active:scale-95"
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {currentIndex > 0 && (
        <button
          type="button"
          onClick={() => goToVideo(currentIndex - 1)}
          className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white opacity-70 backdrop-blur-xl transition-transform active:scale-95"
          aria-label="Previous video"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {currentIndex < videos.length - 1 && (
        <button
          type="button"
          onClick={() => goToVideo(currentIndex + 1)}
          className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white opacity-70 backdrop-blur-xl transition-transform active:scale-95"
          aria-label="Next video"
        >
          <ChevronRight size={24} />
        </button>
      )}

      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 6,
        zIndex: 10,
      }}>
        {videos.slice(Math.max(0, currentIndex - 3), Math.min(videos.length, currentIndex + 4)).map((_, i) => {
          const actualIndex = Math.max(0, currentIndex - 3) + i;
          return (
            <button
              type="button"
              key={actualIndex}
              onClick={() => goToVideo(actualIndex)}
              style={{
                width: actualIndex === currentIndex ? 24 : 6,
                height: 6,
                borderRadius: 3,
                background: actualIndex === currentIndex 
                  ? 'linear-gradient(90deg, #6F4FFF, #FFB800)' 
                  : 'rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              aria-label={`Go to video ${actualIndex + 1}`}
            />
          );
        })}
      </div>

      {showComments && currentVideo && (
        <Comments
          videoId={currentVideo.id}
          onClose={() => setShowComments(false)}
        />
      )}

      {showGuestPrompt && (
        <GuestPrompt onClose={() => setShowGuestPrompt(false)} context={guestPromptContext} />
      )}
    </div>
  );
}

export default Home;
