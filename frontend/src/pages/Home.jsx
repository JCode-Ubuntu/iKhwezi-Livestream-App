import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from '../components/VideoPlayer';
import VideoActions from '../components/VideoActions';
import Comments from '../components/Comments';
import GuestPrompt from '../components/GuestPrompt';
import CosmicBackground from '../components/CosmicBackground';
import SkeletonStream from '../components/SkeletonStream';
import { StoryTray } from '../components/Stories';
import StoryCreator from '../components/StoryCreator';
import { Volume2, VolumeX, Sparkles, Play, Flame, TrendingUp, MessageCircle, PenLine, X, ChevronUp, ChevronDown } from 'lucide-react';
import FeedDiscovery from '../components/FeedDiscovery';

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Hero Carousel â€” top trending / sponsored videos
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
              <span>â¤ï¸ {v.likeCount || 0}</span>
              <span>ðŸ’¬ {v.commentCount || 0}</span>
              <span>ðŸ‘ {v.views || 0}</span>
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Video Grid Thumbnail
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
          <span>â¤ {video.likeCount || 0}</span>
          <span>â–¶ {video.views || 0}</span>
        </div>
      </div>
      {video.isTrending && (
        <div className="absolute left-1.5 top-1.5 rounded-full bg-orange-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">
          ðŸ”¥
        </div>
      )}
    </button>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Full-screen video player overlay
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function FullscreenFeed({ videos, startIndex, onClose, muted, setMuted, onUpdate, showGuestPrompt }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showComments, setShowComments] = useState(false);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);

  const currentVideo = videos[currentIndex];

  const go = useCallback((dir) => {
    setCurrentIndex(i => {
      const next = i + dir;
      if (next < 0 || next >= videos.length) return i;
      return next;
    });
  }, [videos.length]);

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
  }, [go, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform active:scale-95"
        style={{ top: 'max(16px, env(safe-area-inset-top))', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}
      >
        <X size={20} />
      </button>
      {/* Mute */}
      <button
        type="button"
        onClick={() => setMuted(m => !m)}
        className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform active:scale-95"
        style={{ top: 'max(16px, env(safe-area-inset-top))', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}
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
              onShowComments={() => setShowComments(true)}
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
        <button
          type="button"
          onClick={() => go(-1)}
          className="absolute left-1/2 z-10 -translate-x-1/2 flex items-center justify-center rounded-full text-white/85 transition-all active:scale-95"
          style={{ top: 72, width: 40, height: 40, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}
        >
          <ChevronUp size={20} />
        </button>
      )}
      {currentIndex < videos.length - 1 && (
        <button
          type="button"
          onClick={() => go(1)}
          className="absolute left-1/2 z-10 -translate-x-1/2 flex items-center justify-center rounded-full text-white/85 transition-all active:scale-95"
          style={{ bottom: 96, width: 40, height: 40, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}
        >
          <ChevronDown size={20} />
        </button>
      )}

      {/* Trending discovery — lets users jump to any trending video while in fullscreen */}
      <div className="absolute inset-x-0 z-[9]" style={{ top: 68 }}>
        <FeedDiscovery videos={videos} currentIndex={currentIndex} onPickIndex={setCurrentIndex} />
      </div>

      {/* Comments sheet - inside FullscreenFeed so currentVideo is always valid */}
      {showComments && currentVideo && (
        <Comments videoId={currentVideo.id} onClose={() => setShowComments(false)} />
      )}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Main Home page
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function Home() {
  const { fetchWithAuth, isGuest, guestInteractions, trackGuestInteraction } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestPromptContext, setGuestPromptContext] = useState('default');
  const [muted, setMuted] = useState(true);
  const [fullscreenIndex, setFullscreenIndex] = useState(null);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
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
    <div className="relative h-full overflow-y-auto bg-[#050816] pb-[70px]">
      <CosmicBackground intensity={0.2} />

      {/* ── Stories Tray ── */}
      <div className="relative z-10 border-b border-white/5 bg-[#050816]/80">
        <StoryTray onAddStory={() => setShowStoryCreator(true)} />
      </div>

      {/* ── Hero Carousel ── */}
      <HeroCarousel
        videos={heroVideos}
        muted={muted}
        onOpen={(heroIdx) => {
          const vid = heroVideos[heroIdx];
          const realIdx = videos.findIndex(v => v.id === vid?.id);
          setFullscreenIndex(realIdx >= 0 ? realIdx : heroIdx);
        }}
      />

      {/* â”€â”€ Grid Section Header â”€â”€ */}
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-neon-cyan" />
          <span className="text-sm font-bold uppercase tracking-wider text-white/80">Latest</span>
        </div>
        <span className="text-xs text-white/30">{gridVideos.length} videos</span>
      </div>

      {/* ââ 3-Column Grid ââ */}
      <div className="grid grid-cols-3 gap-2 px-2" style={{ gridAutoRows: 'auto' }}>
        {gridVideos.map((video, index) => (
          <GridThumb
            key={video.id}
            video={video}
            onClick={() => {
              const realIdx = videos.findIndex(v => v.id === video.id);
              setFullscreenIndex(realIdx >= 0 ? realIdx : heroVideos.length + index);
            }}
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

      {/* â”€â”€ Fullscreen player overlay â”€â”€ */}
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

      {showGuestPrompt && (
        <GuestPrompt onClose={() => setShowGuestPrompt(false)} context={guestPromptContext} />
      )}

      {showStoryCreator && (
        <StoryCreator
          onClose={() => setShowStoryCreator(false)}
          onPosted={() => setShowStoryCreator(false)}
        />
      )}
    </div>
  );
}

export default Home;
