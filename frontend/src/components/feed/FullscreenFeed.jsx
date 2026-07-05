import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, X, ChevronUp, ChevronDown } from 'lucide-react';
import VideoPlayer from '../VideoPlayer';
import VideoActions from '../VideoActions';
import Comments from '../Comments';
import FeedDiscovery from '../FeedDiscovery';

export default function FullscreenFeed({
  videos,
  startIndex,
  onClose,
  muted,
  setMuted,
  onUpdate,
  showGuestPrompt,
}) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showComments, setShowComments] = useState(false);
  const touchStartY = useRef(0);
  const currentVideo = videos[currentIndex];

  const go = useCallback(
    (dir) => {
      setCurrentIndex((i) => {
        const next = i + dir;
        if (next < 0 || next >= videos.length) return i;
        return next;
      });
    },
    [videos.length]
  );

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
      className="fixed inset-0 z-[250] overflow-hidden bg-void-950"
      onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => {
        const dy = touchStartY.current - e.changedTouches[0].clientY;
        if (Math.abs(dy) > 50) go(dy > 0 ? 1 : -1);
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="ultima-glass absolute left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full text-white"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        <X size={20} />
      </button>
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="ultima-glass absolute right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full text-white"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <div
        className="h-full"
        style={{
          transform: `translateY(-${currentIndex * 100}%)`,
          transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {videos.map((video, index) => (
          <div key={video.id} className="relative h-screen w-full">
            <VideoPlayer
              src={`/storage/uploads/${video.filename}`}
              isActive={index === currentIndex}
              muted={muted}
            />
            <VideoActions
              video={video}
              onUpdate={onUpdate}
              onShowComments={() => setShowComments(true)}
              onShowLogin={showGuestPrompt}
            />
            <div
              className="pointer-events-none absolute bottom-36 left-4 z-10 max-w-[calc(100%-5.5rem)]"
            >
              <p className="font-display text-sm font-bold text-gold-300">
                @{video.creator?.username || 'unknown'}
              </p>
              {video.caption && (
                <p className="mt-2 line-clamp-3 text-sm text-white/85">{video.caption}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {currentIndex > 0 && (
        <button
          type="button"
          onClick={() => go(-1)}
          className="ultima-glass absolute left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full text-white"
          style={{ top: 72 }}
        >
          <ChevronUp size={20} />
        </button>
      )}
      {currentIndex < videos.length - 1 && (
        <button
          type="button"
          onClick={() => go(1)}
          className="ultima-glass absolute right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full text-white"
          style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <ChevronDown size={20} />
        </button>
      )}

      <div
        className="absolute right-3 z-[15]"
        style={{ top: 'max(4.75rem, calc(env(safe-area-inset-top, 0px) + 3.5rem))' }}
      >
        <FeedDiscovery videos={videos} currentIndex={currentIndex} onPickIndex={setCurrentIndex} />
      </div>

      {showComments && currentVideo && (
        <Comments videoId={currentVideo.id} onClose={() => setShowComments(false)} />
      )}
    </div>
  );
}
