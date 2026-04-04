import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from '../components/VideoPlayer';
import VideoActions from '../components/VideoActions';
import Comments from '../components/Comments';
import GuestPrompt from '../components/GuestPrompt';
import CosmicBackground from '../components/CosmicBackground';
import FeedDiscovery from '../components/FeedDiscovery';
import SkeletonStream from '../components/SkeletonStream';
import ReactionsBar from '../components/ReactionsBar';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Sparkles } from 'lucide-react';

function Home() {
  const { fetchWithAuth } = useAuth();
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

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

  // Hide GuestPrompt - free access mode
  const handleShowGuestPrompt = () => {
    // No-op: Guest prompt disabled for free access
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
        <GuestPrompt onClose={() => setShowGuestPrompt(false)} />
      )}
    </div>
  );
}

export default Home;
