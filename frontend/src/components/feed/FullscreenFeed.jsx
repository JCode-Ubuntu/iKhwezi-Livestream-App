import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, X, ChevronUp, ChevronDown, Heart, Music2, Eye, Megaphone, ExternalLink } from 'lucide-react';
import VideoPlayer from '../VideoPlayer';
import VideoActions from '../VideoActions';
import ReelTopOverlay from '../ReelTopOverlay';
import Comments from '../Comments';
import FeedDiscovery from '../FeedDiscovery';
import { useAuth } from '../../context/AuthContext';
import { useNavDock } from '../../context/NavVisibilityContext';
import { resolveMediaUrl } from '../../config/appConfig';
import { isVideoFile } from '../MediaPreview';
import { adSlideKey } from '../../utils/feedAds';

export default function FullscreenFeed({
  videos,
  slides: slidesProp,
  startIndex,
  onClose,
  muted,
  setMuted,
  onUpdate,
  showGuestPrompt,
  showTrackMeta = false,
  embedded = false,
}) {
  const { isAuthenticated, isGuest, fetchWithAuth } = useAuth();
  const { hideDock, showDock } = useNavDock();
  const slides = slidesProp?.length
    ? slidesProp
    : videos.map((v) => ({ type: 'video', data: v }));
  const discoveryVideos = videos;

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showComments, setShowComments] = useState(false);
  const [burst, setBurst] = useState(null);
  const [reelChromeVisible, setReelChromeVisible] = useState(true);
  const touchStartY = useRef(0);
  const isTouching = useRef(false);
  const settleTimer = useRef(null);
  const lastTapRef = useRef({ time: 0, index: -1 });
  const viewedAds = useRef(new Set());
  const lastStartIndexRef = useRef(startIndex);

  // All current call sites (Home/Reels/Explore) only ever mount this
  // component fresh — `startIndex` never changes on an already-mounted
  // instance today, since they gate rendering behind `fullscreenIndex !==
  // null` and the underlying feed isn't interactive while this covers the
  // screen. Still, `useState(startIndex)` alone would silently ignore a
  // future caller that reuses one instance for multiple opens (e.g. a "next
  // video" deep link), so re-sync defensively if it ever does change.
  useEffect(() => {
    if (startIndex !== lastStartIndexRef.current) {
      lastStartIndexRef.current = startIndex;
      setCurrentIndex(startIndex);
    }
  }, [startIndex]);

  const currentSlide = slides[currentIndex];
  const currentVideo = currentSlide?.type === 'video' ? currentSlide.data : null;

  const recordAdView = useCallback(
    async (adId) => {
      if (!adId || viewedAds.current.has(adId)) return;
      viewedAds.current.add(adId);
      try {
        await fetchWithAuth(`/ads/${adId}/view`, { method: 'POST' });
      } catch {
        /* non-critical */
      }
    },
    [fetchWithAuth]
  );

  const handleAdClick = useCallback(
    async (ad) => {
      try {
        const res = await fetchWithAuth(`/ads/${ad.id}/click`, { method: 'POST' });
        const data = await res.json();
        const url = data.clickUrl || ad.clickUrl;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        if (ad.clickUrl) window.open(ad.clickUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [fetchWithAuth]
  );

  useEffect(() => {
    if (currentSlide?.type === 'ad') {
      recordAdView(currentSlide.data.id);
    }
  }, [currentIndex, currentSlide, recordAdView]);

  const handleDoubleTapLike = useCallback(
    async (video, index) => {
      setBurst({ index, key: Date.now() });
      if (!isAuthenticated || isGuest) {
        showGuestPrompt?.();
        return;
      }
      if (video.isLiked) return;
      try {
        const res = await fetchWithAuth(`/videos/${video.id}/like`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) return;
        onUpdate?.({ ...video, isLiked: data.liked, likeCount: data.likeCount });
      } catch {
        /* silent */
      }
    },
    [isAuthenticated, isGuest, fetchWithAuth, onUpdate, showGuestPrompt]
  );

  const handleSlideTap = useCallback(
    (slide, index) => {
      if (slide.type === 'ad') return;
      const video = slide.data;
      const now = Date.now();
      if (lastTapRef.current.index === index && now - lastTapRef.current.time < 320) {
        lastTapRef.current = { time: 0, index: -1 };
        handleDoubleTapLike(video, index);
      } else {
        lastTapRef.current = { time: now, index };
      }
    },
    [handleDoubleTapLike]
  );

  const markReelScrolling = useCallback(() => {
    setReelChromeVisible(false);
    hideDock();
    clearTimeout(settleTimer.current);
  }, [hideDock]);

  const markReelSettled = useCallback((delayMs = 0) => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      setReelChromeVisible(true);
      showDock();
    }, delayMs);
  }, [showDock]);

  const go = useCallback(
    (dir) => {
      markReelScrolling();
      setCurrentIndex((i) => {
        const next = i + dir;
        if (next < 0 || next >= slides.length) {
          markReelSettled(0);
          return i;
        }
        return next;
      });
    },
    [slides.length, markReelScrolling, markReelSettled],
  );

  const indexAtMount = useRef(currentIndex);
  useEffect(() => {
    if (indexAtMount.current === currentIndex) return;
    indexAtMount.current = currentIndex;
    markReelSettled(420);
  }, [currentIndex, markReelSettled]);

  useEffect(() => () => {
    clearTimeout(settleTimer.current);
    showDock();
  }, [showDock]);

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
      className={
        embedded
          ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden bg-void-950'
          : 'fixed inset-0 z-[250] overflow-hidden bg-void-950'
      }
      onTouchStart={(e) => {
        isTouching.current = true;
        touchStartY.current = e.touches[0].clientY;
      }}
      onTouchMove={(e) => {
        if (!isTouching.current) return;
        const dy = Math.abs(touchStartY.current - e.touches[0].clientY);
        if (dy > 6) markReelScrolling();
      }}
      onTouchEnd={(e) => {
        isTouching.current = false;
        const dy = touchStartY.current - e.changedTouches[0].clientY;
        if (Math.abs(dy) > 50) {
          go(dy > 0 ? 1 : -1);
        } else {
          markReelSettled(0);
        }
      }}
    >
      {!embedded && (
        <button
          type="button"
          onClick={onClose}
          className="ultima-glass absolute left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full text-white"
          style={{ top: 'max(16px, env(safe-area-inset-top))' }}
        >
          <X size={20} />
        </button>
      )}
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="ultima-glass absolute right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full text-white"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <div
        className={embedded ? 'h-full min-h-0 flex-1' : 'h-full'}
        style={{
          transform: `translateY(-${currentIndex * 100}%)`,
          transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {slides.map((slide, index) => {
          // Every slide used to render a real <video src> unconditionally,
          // regardless of distance from currentIndex — with infinite scroll
          // feeding this list (up to dozens/hundreds of slides), that meant
          // every scrolled-through video stayed mounted with a live <video>
          // element pointed at a real media URL, so browsers kept
          // buffering/decoding all of them at once. Mobile WebViews (this
          // ships inside a Capacitor app) enforce a low concurrent
          // <video>/decoder limit — iOS Safari in particular silently fails
          // to play once it's exceeded — so this caused videos to stop
          // playing or stutter after scrolling through a handful of items.
          // Only the current slide and its immediate neighbors (for a
          // smooth swipe transition) get a real, network-loading `src`.
          const isNearCurrent = Math.abs(index - currentIndex) <= 1;
          return (
          <div
            key={slide.type === 'ad' ? adSlideKey(slide.data) : slide.data.id}
            className={`relative w-full ${embedded ? 'h-full' : 'h-screen'}`}
            onClick={() => handleSlideTap(slide, index)}
          >
            {slide.type === 'ad' ? (
              <>
                {slide.data.mediaType === 'video' ? (
                  <VideoPlayer
                    src={isNearCurrent ? resolveMediaUrl(slide.data.filename) : ''}
                    isActive={index === currentIndex}
                    muted={muted}
                  />
                ) : (
                  <img
                    src={resolveMediaUrl(slide.data.filename)}
                    alt={slide.data.title || 'Sponsored'}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-void-950 via-transparent to-void-950/30" />
                <div className="absolute left-4 top-20 flex items-center gap-1.5 rounded-full border border-gold-400/35 bg-black/45 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold-200 backdrop-blur-sm">
                  <Megaphone size={12} />
                  Sponsored
                </div>
                <div className="pointer-events-none absolute bottom-36 left-4 z-10 max-w-[calc(100%-5.5rem)]">
                  <p className="font-display text-sm font-bold text-gold-300">
                    {slide.data.title || 'iKHWEZI'}
                  </p>
                  {slide.data.caption && (
                    <p className="mt-2 line-clamp-3 text-sm text-white/85">{slide.data.caption}</p>
                  )}
                </div>
                {slide.data.clickUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdClick(slide.data);
                    }}
                    className="absolute bottom-28 left-4 right-20 z-20 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 to-amber-500 py-3.5 text-sm font-bold text-void-950 shadow-lg shadow-gold-500/30"
                  >
                    <ExternalLink size={16} />
                    {slide.data.ctaLabel || 'Learn more'}
                  </button>
                )}
              </>
            ) : (
              <>
                {isVideoFile(slide.data.filename) ? (
                  <VideoPlayer
                    src={isNearCurrent ? resolveMediaUrl(slide.data.filename) : ''}
                    isActive={index === currentIndex}
                    muted={muted}
                  />
                ) : (
                  <img
                    src={isNearCurrent ? resolveMediaUrl(slide.data.filename) : ''}
                    alt={slide.data.caption || slide.data.title || 'Post'}
                    className="h-full w-full object-cover"
                  />
                )}
                {burst?.index === index && (
                  <div
                    key={burst.key}
                    className="ik-heart-burst"
                    onAnimationEnd={() => setBurst(null)}
                  >
                    <Heart size={116} className="text-pink-500" fill="#E1306C" strokeWidth={0} />
                  </div>
                )}
                <ReelTopOverlay
                  video={slide.data}
                  visible={reelChromeVisible && index === currentIndex}
                  onUpdate={onUpdate}
                  onShowLogin={showGuestPrompt}
                />
                <VideoActions
                  video={slide.data}
                  onUpdate={onUpdate}
                  onShowComments={() => setShowComments(true)}
                  onShowLogin={showGuestPrompt}
                  visible={reelChromeVisible && index === currentIndex}
                />
                <div
                  className={`reel-overlay-chrome pointer-events-none absolute bottom-36 left-4 z-10 max-w-[calc(100%-5.5rem)] ${
                    reelChromeVisible && index === currentIndex ? '' : 'reel-overlay-chrome--hidden'
                  }`}
                >
                  {slide.data.caption && (
                    <p className="line-clamp-3 text-sm text-white/85">{slide.data.caption}</p>
                  )}
                  {showTrackMeta && (
                    <div className="mt-2.5 flex items-center gap-3 text-[11px] font-medium text-white/60">
                      <span className="flex items-center gap-1.5">
                        <Music2 size={12} className="text-pink-300" />
                        Original audio · @{slide.data.creator?.username || 'unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {slide.data.views || 0}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          );
        })}
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
      {currentIndex < slides.length - 1 && (
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
        <FeedDiscovery
          videos={discoveryVideos}
          slides={slides.length !== discoveryVideos.length ? slides : undefined}
          currentIndex={currentIndex}
          onPickIndex={(idx) => {
            if (idx === currentIndex) return;
            markReelScrolling();
            setCurrentIndex(idx);
          }}
        />
      </div>

      {showComments && currentVideo && (
        <Comments
          videoId={currentVideo.id}
          onClose={() => setShowComments(false)}
          onGuestBlock={showGuestPrompt}
        />
      )}
    </div>
  );
}
