import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Star, Eye, X } from 'lucide-react';
import {
  normalizeCommunityPost,
  pickCommunityBatch,
  preloadCommunityThumbnails,
} from '../utils/communityPosts';
import { resolveMediaUrl } from '../config/appConfig';

const SWAP_MS = 520;
const PREFETCH_LEAD_MS = 5000;

function formatCount(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

function CommunityMiniCard({ post, onClick, animPhase, index, compact = false }) {
  const cover = post.carouselCover || post.thumbnailUrl || post.mediaUrl;
  const isVideo = post.type === 'video';

  return (
    <button
      type="button"
      onClick={() => onClick(post)}
      className={`community-grid-card ultima-spotlight-ring group relative w-full overflow-hidden rounded-[18px] bg-void-950 text-left ${
        compact ? 'h-full min-h-0' : 'aspect-[3/4]'
      } ${animPhase === 'enter' ? 'community-grid-card--enter' : ''} ${
        animPhase === 'exit' ? 'community-grid-card--exit' : ''
      }`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {isVideo ? (
        <video
          src={post.mediaUrl}
          poster={cover !== post.mediaUrl ? cover : undefined}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          muted
          playsInline
          preload="none"
        />
      ) : (
        <img
          src={cover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          loading="lazy"
          decoding="async"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/25 to-void-950/10" />

      {post.isAd && (
        <span className="absolute left-2.5 top-2.5 rounded-full border border-gold-400/35 bg-black/50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-gold-200">
          Sponsored
        </span>
      )}

      {isVideo && (
        <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-lg backdrop-blur-sm transition group-hover:scale-105">
          <Play size={14} fill="currentColor" className="ml-0.5" />
        </span>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-1 p-2.5">
        {post.creator && (
          <div className="flex min-w-0 items-center gap-1.5">
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[8px] font-bold text-white"
              style={{
                background: post.creator.avatar
                  ? undefined
                  : 'linear-gradient(135deg,#E1306C,#F5C542)',
              }}
            >
              {post.creator.avatar ? (
                <img
                  src={resolveMediaUrl(post.creator.avatar)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                (post.creator.username || '?').charAt(0).toUpperCase()
              )}
            </div>
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2 text-[9px] font-semibold text-white/85">
          <span className="inline-flex items-center gap-0.5">
            <Star size={9} className="fill-gold-300 text-gold-300" />
            {formatCount(post.starCount)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Eye size={9} />
            {formatCount(post.viewCount)}
          </span>
        </div>
      </div>
    </button>
  );
}

function ImagePostViewer({ post, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-void-950/95 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Image post"
    >
      <button
        type="button"
        onClick={onClose}
        className="ultima-glass absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <img
        src={post.mediaUrl}
        alt=""
        className="max-h-[85vh] max-w-full rounded-[20px] object-contain shadow-2xl"
      />
    </div>
  );
}

/**
 * Dynamic community preview grid — auto-rotating mini cards with premium transitions.
 */
export default function CommunityContentGrid({
  posts = [],
  refreshInterval = 30000,
  layout = 'row',
  animation = 'fade-slide-scale',
  maxCards = 3,
  compact = false,
  seamless = false,
  onPostClick,
  onRefresh,
  className = '',
}) {
  const pool = useMemo(
    () => posts.map((p) => (p.type ? p : normalizeCommunityPost(p))),
    [posts]
  );

  const sessionRef = useRef({});
  const [visible, setVisible] = useState([]);
  const [animPhase, setAnimPhase] = useState('idle');
  const [imageViewer, setImageViewer] = useState(null);
  const nextBatchRef = useRef(null);
  const swappingRef = useRef(false);
  const intervalRef = useRef(null);
  const prefetchRef = useRef(null);

  const applyBatch = useCallback(
    async (batch, animate = true) => {
      if (!batch?.length) return;
      await preloadCommunityThumbnails(batch);
      if (!animate) {
        setVisible(batch);
        setAnimPhase('idle');
        return;
      }
      if (swappingRef.current) return;
      swappingRef.current = true;
      setAnimPhase('exit');
      await new Promise((r) => setTimeout(r, SWAP_MS * 0.55));
      setVisible(batch);
      setAnimPhase('enter');
      await new Promise((r) => setTimeout(r, SWAP_MS));
      setAnimPhase('idle');
      swappingRef.current = false;
    },
    []
  );

  const prepareNext = useCallback(() => {
    const batch = pickCommunityBatch(pool, maxCards, sessionRef.current);
    nextBatchRef.current = batch;
    preloadCommunityThumbnails(batch);
    return batch;
  }, [pool, maxCards]);

  const hasVisibleRef = useRef(false);

  useEffect(() => {
    hasVisibleRef.current = visible.length > 0;
  }, [visible.length]);

  const rotate = useCallback(async () => {
    if (!pool.length || swappingRef.current) return;
    const batch = nextBatchRef.current?.length
      ? nextBatchRef.current
      : pickCommunityBatch(pool, maxCards, sessionRef.current);
    nextBatchRef.current = null;
    await applyBatch(batch, hasVisibleRef.current);
    prepareNext();
    onRefresh?.();
  }, [pool, maxCards, applyBatch, prepareNext, onRefresh]);

  useEffect(() => {
    if (!pool.length) {
      setVisible([]);
      return undefined;
    }
    const initial = pickCommunityBatch(pool, maxCards, sessionRef.current);
    applyBatch(initial, false);
    prepareNext();
    return undefined;
  }, [pool, maxCards, applyBatch, prepareNext]);

  useEffect(() => {
    if (!pool.length) return undefined;
    intervalRef.current = setInterval(rotate, refreshInterval);
    prefetchRef.current = setInterval(() => {
      if (!nextBatchRef.current?.length) prepareNext();
      else preloadCommunityThumbnails(nextBatchRef.current);
    }, Math.max(refreshInterval - PREFETCH_LEAD_MS, 5000));

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(prefetchRef.current);
    };
  }, [pool.length, refreshInterval, rotate, prepareNext]);

  const handleClick = (post) => {
    if (post.isAd) {
      onPostClick?.(post);
      return;
    }
    if (post.type === 'image') {
      setImageViewer(post);
      return;
    }
    onPostClick?.(post);
  };

  if (!pool.length) return null;

  const gridClass =
    layout === 'scroll'
      ? 'flex gap-2 overflow-x-auto pb-0.5'
      : layout === 'row'
        ? `grid grid-cols-3 gap-2.5 sm:gap-3 ${compact ? 'h-full min-h-0' : ''}`
        : 'grid grid-cols-1 gap-3';

  const sectionClass = seamless
    ? `community-content-grid community-content-grid--seamless ${className}`
    : `community-content-grid ${compact ? 'mx-3 mt-0 h-full' : 'mx-4 mt-6'} ${className}`;

  return (
    <>
      <section
        className={sectionClass}
        data-animation={animation}
        aria-label="Community feed"
      >
        <div className={gridClass}>
          {visible.map((post, index) => (
            layout === 'scroll' ? (
              <div key={`${post.id}-${animPhase}-${index}`} className="h-[96px] w-[72px] shrink-0">
                <CommunityMiniCard
                  post={post}
                  index={index}
                  compact
                  animPhase={animPhase}
                  onClick={handleClick}
                />
              </div>
            ) : (
              <CommunityMiniCard
                key={`${post.id}-${animPhase}-${index}`}
                post={post}
                index={index}
                compact={compact}
                animPhase={animPhase}
                onClick={handleClick}
              />
            )
          ))}
        </div>
        {seamless && <div className="home-community-fade" aria-hidden />}
      </section>

      {imageViewer && (
        <ImagePostViewer post={imageViewer} onClose={() => setImageViewer(null)} />
      )}
    </>
  );
}
