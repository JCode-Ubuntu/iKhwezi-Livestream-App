import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from '../components/VideoPlayer';
import VideoActions from '../components/VideoActions';
import Comments from '../components/Comments';
import GuestPrompt from '../components/GuestPrompt';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Sparkles } from 'lucide-react';

function Home() {
  const { fetchWithAuth, isAuthenticated } = useAuth();
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

  const goToVideo = (index) => {
    if (index >= 0 && index < videos.length) {
      setCurrentIndex(index);
    }
  };

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
  }, [currentIndex, videos.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const updateVideo = (updatedVideo) => {
    setVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
  };

  const currentVideo = videos[currentIndex];

  if (loading && videos.length === 0) {
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
          background: 'linear-gradient(135deg, #6F4FFF, #FFB800)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}>
          <Sparkles size={36} color="white" />
        </div>
        <p style={{ color: '#A0A0A0', fontSize: 16 }}>Loading amazing content...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 40,
        paddingBottom: 110,
        textAlign: 'center',
      }}>
        <div style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6F4FFF20, #FFB80020)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Sparkles size={48} color="#6F4FFF" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>No Videos Yet</h2>
        <p style={{ color: '#A0A0A0', maxWidth: 280 }}>
          Be the first to share amazing content on iKHWEZI!
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: '#000',
        marginBottom: 70,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{
        display: 'flex',
        height: '100%',
        transition: 'transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
        transform: `translateX(-${currentIndex * 100}%)`,
      }}>
        {videos.map((video, index) => (
          <div
            key={video.id}
            style={{
              minWidth: '100%',
              height: '100%',
              position: 'relative',
            }}
          >
            <VideoPlayer
              src={`/storage/uploads/${video.filename}`}
              isActive={index === currentIndex}
            />
            
            <VideoActions
              video={video}
              onUpdate={updateVideo}
              onShowComments={() => setShowComments(true)}
              onShowLogin={() => setShowGuestPrompt(true)}
            />

            <div style={{
              position: 'absolute',
              left: 16,
              bottom: 80,
              right: 80,
              zIndex: 10,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}>
                <div className="avatar" style={{ 
                  width: 40, 
                  height: 40,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                }}>
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
        onClick={() => setMuted(!muted)}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          zIndex: 10,
        }}
      >
        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {currentIndex > 0 && (
        <button
          onClick={() => goToVideo(currentIndex - 1)}
          style={{
            position: 'absolute',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            zIndex: 10,
            opacity: 0.7,
          }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {currentIndex < videos.length - 1 && (
        <button
          onClick={() => goToVideo(currentIndex + 1)}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            zIndex: 10,
            opacity: 0.7,
          }}
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
            <div
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
