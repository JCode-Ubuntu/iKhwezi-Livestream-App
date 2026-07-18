import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GuestPrompt from '../components/GuestPrompt';
import { StoryTray } from '../components/Stories';
import StoryCreator from '../components/StoryCreator';
import SkeletonStream from '../components/SkeletonStream';
import FullscreenFeed from '../components/feed/FullscreenFeed';
import TextPostCard from '../components/feed/TextPostCard';
import AdTile from '../components/feed/AdTile';
import CommunityContentGrid from '../components/CommunityContentGrid';
import UltimaField from '../ultima/UltimaField';
import { Play, Orbit, Eye, Sparkles, Send, Users, ChevronRight } from 'lucide-react';
import MediaPreview from '../components/MediaPreview';
import { IKHWEZI_LOGO_URL } from '../config/brandAssets';
import {
  filterAdsByPlacement,
  mixAdsIntoFeed,
  mixAdsIntoSlides,
  findSlideIndex,
} from '../utils/feedAds';

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return '0:00';
  const s = Math.max(0, Math.floor(Number(seconds)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Spotlight({ videos, muted, onOpen, compact = false }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (videos.length < 2) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % videos.length), 5000);
    return () => clearInterval(t);
  }, [videos.length]);
  if (!videos.length) return null;
  const v = videos[idx];

  return (
    <section
      className={`home-spotlight-card relative overflow-hidden rounded-[28px] ultima-spotlight-ring ${
        compact ? 'mx-3 h-full' : 'mx-4 mt-4'
      }`}
    >
      <div
        className={`relative w-full ${
          compact
            ? 'h-full min-h-0'
            : 'aspect-[4/5] max-h-[58vh] sm:aspect-video sm:max-h-[52vh]'
        }`}
      >
        <MediaPreview
          key={v.id}
          filename={v.filename}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted={muted}
          loop
          playsInline
          style={{ filter: 'brightness(0.5) saturate(1.2)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-pink-700/25 via-transparent to-gold-900/20" />

        {v.isLive && (
          <div className="absolute left-3 top-3 sm:left-5 sm:top-5">
            <span className="animate-pulse rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold text-white">
              LIVE
            </span>
          </div>
        )}

        <div className={`absolute bottom-0 left-0 right-0 ${compact ? 'p-3.5' : 'p-6'}`}>
          <p className="font-display text-[10px] font-medium uppercase tracking-[0.2em] text-plasma-300/80 sm:text-xs">
            @{v.creator?.username || 'signal'}
          </p>
          {v.caption && (
            <h2
              className={`ultima-text-glow mt-1 font-display font-black leading-tight text-white ${
                compact ? 'line-clamp-2 text-base' : 'mt-2 text-2xl sm:text-3xl'
              }`}
            >
              {v.caption}
            </h2>
          )}
          <div className={`flex items-center justify-between gap-3 ${compact ? 'mt-2' : 'mt-4'}`}>
            <div className="flex gap-3 text-[10px] text-white/50 sm:text-xs">
              <span>{v.likeCount || 0} stars</span>
              <span className="inline-flex items-center gap-1">
                <Eye size={11} />
                {v.views || 0}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpen(idx)}
              className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-amber-500 text-void-950 shadow-xl shadow-gold-500/40 transition active:scale-95 ${
                compact ? 'h-10 w-10' : 'h-14 w-14'
              }`}
            >
              <Play size={compact ? 16 : 22} fill="currentColor" className="ml-0.5" />
            </button>
          </div>
          <div className={`flex justify-center gap-1.5 ${compact ? 'mt-2' : 'mt-4'}`}>
            {videos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === idx ? 20 : 5,
                  background: i === idx
                    ? 'linear-gradient(90deg, #F5C542, #E1306C)'
                    : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LatestSignalsStrip({ items, onOpen }) {
  const preview = items.slice(0, 4);
  if (!preview.length) return null;

  return (
    <div className="home-latest-strip relative h-full min-h-0 px-3">
      <div className="flex h-full gap-2 overflow-hidden">
        {preview.map((item, index) => {
          const isVideo = item.type === 'video';
          const isAd = item.type === 'ad';
          const data = item.data;
          const thumb = isVideo || isAd ? data.filename : null;
          const label = data.creator?.username || data.title || 'signal';

          return (
            <button
              key={`${item.type}-${data.id}-${index}`}
              type="button"
              onClick={() => onOpen(data, isAd ? 'ad' : isVideo ? 'video' : 'video')}
              className="home-latest-tile ultima-glass-supreme group relative min-w-0 flex-1 overflow-hidden rounded-[14px]"
              style={{ opacity: Math.max(0.45, 1 - index * 0.14) }}
            >
              {thumb ? (
                <MediaPreview
                  filename={thumb}
                  className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:opacity-90"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-pink-900/40 to-gold-900/30 p-2">
                  <p className="line-clamp-2 text-left text-[8px] leading-snug text-white/70">
                    {data.content || data.caption || 'Signal'}
                  </p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/50 to-transparent" />
              <p className="absolute bottom-1.5 left-2 right-2 truncate text-left text-[9px] font-semibold text-white/80">
                @{label}
              </p>
            </button>
          );
        })}
      </div>
      <div className="home-latest-fade pointer-events-none absolute inset-x-0 bottom-0 h-8" aria-hidden />
    </div>
  );
}

function BentoTile({ video, tall, onClick, index }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ultima-bento-card ultima-glass-supreme group relative w-full overflow-hidden rounded-[26px]"
      style={{ height: tall ? 280 : 220, animationDelay: `${index * 60}ms` }}
    >
      <MediaPreview
        filename={video.filename}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        muted
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/20 to-transparent" />
      <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-200/90 backdrop-blur-sm">
        {formatDuration(video.duration || video.length)}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
        <p className="truncate font-display text-xs font-semibold text-white">
          @{video.creator?.username || 'unknown'}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-white/55">{video.caption || 'Untitled signal'}</p>
      </div>
    </button>
  );
}

function Home() {
  const navigate = useNavigate();
  const { fetchWithAuth, isGuest, guestInteractions, trackGuestInteraction, isAuthenticated } = useAuth();
  const [videos, setVideos] = useState([]);
  const [ads, setAds] = useState([]);
  const [textPosts, setTextPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestPromptContext, setGuestPromptContext] = useState('default');
  const [muted, setMuted] = useState(true);
  const [fullscreenIndex, setFullscreenIndex] = useState(null);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const loadingMore = useRef(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (isGuest && guestInteractions >= 3 && !showGuestPrompt) {
      setGuestPromptContext('interaction');
      setShowGuestPrompt(true);
    }
  }, [guestInteractions, isGuest, showGuestPrompt]);

  const loadVideos = useCallback(
    async (pageNum = 1, append = false) => {
      if (loadingMore.current) return;
      loadingMore.current = true;
      try {
        const res = await fetchWithAuth(`/videos/feed?page=${pageNum}&limit=20`);
        if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
        const data = await res.json();
        const nextVideos = Array.isArray(data.videos) ? data.videos : [];
        setVideos((prev) => (append ? [...prev, ...nextVideos] : nextVideos));
        if (Array.isArray(data.ads)) {
          setAds(data.ads);
        }
        setHasMore(!!data.hasMore);
        setLoadError(false);
      } catch (err) {
        console.error('Failed to load videos:', err);
        // Without this, a failed fetch left videos/textPosts both empty and
        // fell through to the "Void awaits" empty-state below, which tells
        // the user the platform has no content — actively misleading during
        // a network blip or backend outage instead of offering a retry.
        if (!append) setLoadError(true);
      } finally {
        setLoading(false);
        loadingMore.current = false;
      }
    },
    [fetchWithAuth]
  );

  useEffect(() => { loadVideos(); }, [loadVideos]);

  useEffect(() => {
    fetchWithAuth('/posts?page=1&limit=20')
      .then((r) => r.json())
      .then((data) => setTextPosts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [fetchWithAuth]);

  useEffect(() => {
    if (!sentinelRef.current) return undefined;
    const mq = window.matchMedia('(min-width: 640px)');
    if (!mq.matches) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const next = page + 1;
          setPage(next);
          loadVideos(next, true);
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, loadVideos]);

  const updateVideo = useCallback((updated) => {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }, []);

  const feedAds = useMemo(() => filterAdsByPlacement(ads, 'feed'), [ads]);

  const heroVideos = useMemo(() => {
    const trending = videos.filter((v) => v.isTrending || v.isSponsored);
    return (trending.length >= 3 ? trending : videos).slice(0, 6);
  }, [videos]);

  const communityPool = useMemo(() => {
    const heroIds = new Set(heroVideos.map((v) => v.id));
    const rest = videos.filter((v) => !heroIds.has(v.id));
    const adItems = feedAds.map((ad) => ({
      id: `ad-${ad.id}`,
      isAd: true,
      adId: ad.id,
      filename: ad.filename,
      mediaType: ad.mediaType,
      caption: ad.caption || ad.title,
      isTrending: true,
      creator: { username: 'iKHWEZI', displayName: 'Sponsored' },
      raw: ad,
    }));
    const merged = [...adItems, ...(rest.length >= 3 ? rest : videos)];
    return merged;
  }, [videos, heroVideos, feedAds]);

  const feedItems = useMemo(() => {
    const heroIds = new Set(heroVideos.map((v) => v.id));
    const rest = videos.filter((v) => !heroIds.has(v.id)).map((v) => ({ type: 'video', data: v, createdAt: v.createdAt }));
    const posts = textPosts.map((p) => ({ type: 'text', data: p, createdAt: p.createdAt }));
    const sorted = [...rest, ...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return mixAdsIntoFeed(sorted, feedAds, { interval: 4 });
  }, [videos, heroVideos, textPosts, feedAds]);

  const fullscreenSlides = useMemo(() => {
    const videoSlides = videos.map((v) => ({ type: 'video', data: v }));
    return mixAdsIntoSlides(videoSlides, ads, { interval: 6 });
  }, [videos, ads]);

  const openAt = (item, type = 'video') => {
    if (type === 'ad') {
      const idx = findSlideIndex(fullscreenSlides, item, 'ad');
      setFullscreenIndex(idx >= 0 ? idx : 0);
      return;
    }
    const idx = findSlideIndex(fullscreenSlides, item, 'video');
    setFullscreenIndex(idx >= 0 ? idx : 0);
  };

  if (loading && videos.length === 0) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <UltimaField fixed />
        <div className="ultima-content flex min-h-0 flex-1 flex-col">
          <SkeletonStream rows={4} />
        </div>
      </div>
    );
  }

  if (videos.length === 0 && textPosts.length === 0 && loadError) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <UltimaField intensity={1.2} fixed />
        <div className="ultima-glass-gold relative z-10 flex max-w-sm flex-col items-center gap-5 rounded-[32px] px-8 py-12">
          <Sparkles className="h-12 w-12 text-white/40" />
          <h2 className="ultima-text-glow font-display text-2xl font-black text-white">Couldn't load your feed</h2>
          <p className="text-sm leading-relaxed text-white/55">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => { setLoading(true); loadVideos(1, false); }}
            className="ik-btn ik-btn-primary ik-btn-pill px-6 py-2.5 text-sm font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (videos.length === 0 && textPosts.length === 0) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <UltimaField intensity={1.2} fixed />
        <div className="ultima-glass-gold relative z-10 flex max-w-sm flex-col items-center gap-5 rounded-[32px] px-8 py-12">
          <Sparkles className="h-12 w-12 text-gold-400" />
          <h2 className="ultima-text-glow font-display text-2xl font-black text-white">Void awaits</h2>
          <p className="text-sm leading-relaxed text-white/55">
            Be the first to transmit light into the iKHWEZI constellation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <UltimaField intensity={0.85} fixed />
      <div className="ultima-page ultima-scroll ultima-content home-page-shell">
      <header className="home-top-bar shrink-0 px-4 pb-1 pt-3 sm:px-5 sm:pb-3 sm:pt-6">
        <div className="flex items-center justify-between gap-2 sm:items-start sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:block">
            <p className="ultima-eyebrow mb-0 hidden sm:mb-2 sm:block">Stream the night</p>
            <img
              src={IKHWEZI_LOGO_URL}
              alt="iKhwezi"
              className="ultima-home-logo-image home-logo-compact sm:home-logo-full"
              width={148}
              height={148}
              decoding="async"
            />
            <p className="ultima-serif mt-0 hidden text-sm text-white/50 sm:mt-2 sm:block">Shine the signal</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:pt-1">
            <div className="ultima-glass-supreme flex items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:gap-2 sm:px-3.5 sm:py-2">
              <Orbit size={13} className="text-pink-400 sm:hidden" />
              <Orbit size={14} className="hidden text-pink-400 sm:block" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 sm:text-[10px]">
                {videos.length} signals
              </span>
            </div>
            {isAuthenticated && !isGuest && (
              <button
                type="button"
                onClick={() => navigate('/messages')}
                aria-label="Messages"
                className="ultima-icon-btn ik-tap-spring flex h-9 w-9 items-center justify-center rounded-full text-white/75 sm:h-10 sm:w-10"
              >
                <Send size={16} strokeWidth={1.9} className="sm:hidden" />
                <Send size={17} strokeWidth={1.9} className="hidden sm:block" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="home-stories-row shrink-0 border-b border-white/5">
        <StoryTray compact onAddStory={() => setShowStoryCreator(true)} />
      </div>

      <div className="home-feed-shell">
        <div className="home-spotlight-slot sm:hidden">
          <Spotlight
            compact
            videos={heroVideos}
            muted={muted}
            onOpen={(heroIdx) => {
              const vid = heroVideos[heroIdx];
              openAt(vid);
            }}
          />
        </div>

        <div className="home-community-slot sm:hidden">
          <CommunityContentGrid
            compact
            posts={communityPool}
            refreshInterval={30000}
            layout="row"
            animation="fade-slide-scale"
            maxCards={3}
            className="home-community-grid"
            onPostClick={(post) => {
              if (post.isAd || post.adId) {
                openAt(post.raw || post, 'ad');
              } else {
                openAt(post.raw || post, 'video');
              }
            }}
            onRefresh={() => {
              if (hasMore && !loadingMore.current) {
                const next = page + 1;
                setPage(next);
                loadVideos(next, true);
              }
            }}
          />
        </div>

        <div className="home-latest-slot sm:hidden">
          <LatestSignalsStrip items={feedItems} onOpen={openAt} />
        </div>

        <div className="home-desktop-extras hidden sm:block">
          <Spotlight
            videos={heroVideos}
            muted={muted}
            onOpen={(heroIdx) => {
              const vid = heroVideos[heroIdx];
              openAt(vid);
            }}
          />

          <CommunityContentGrid
            posts={communityPool}
            refreshInterval={30000}
            layout="row"
            animation="fade-slide-scale"
            maxCards={3}
            onPostClick={(post) => {
              if (post.isAd || post.adId) {
                openAt(post.raw || post, 'ad');
              } else {
                openAt(post.raw || post, 'video');
              }
            }}
            onRefresh={() => {
              if (hasMore && !loadingMore.current) {
                const next = page + 1;
                setPage(next);
                loadVideos(next, true);
              }
            }}
          />

          <div className="ultima-stagger grid grid-cols-2 gap-3 px-4 pt-2">
            {feedItems.map((item, index) =>
              item.type === 'video' ? (
                <BentoTile
                  key={`v-${item.data.id}`}
                  video={item.data}
                  tall={index % 3 === 0}
                  index={index}
                  onClick={() => openAt(item.data, 'video')}
                />
              ) : item.type === 'ad' ? (
                <AdTile
                  key={`a-${item.data.id}`}
                  ad={item.data}
                  tall={index % 3 === 0}
                  index={index}
                  onClick={() => openAt(item.data, 'ad')}
                />
              ) : (
                <TextPostCard
                  key={`t-${item.data.id}`}
                  post={item.data}
                  tall={index % 3 === 0}
                  onOpenAuthor={(id) => id && navigate(`/profile/${id}`)}
                  onGuestBlock={() => {
                    setGuestPromptContext('interaction');
                    setShowGuestPrompt(true);
                  }}
                />
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/community')}
            className="home-join-community ik-tap-spring ultima-glass-supreme mx-4 mt-8 mb-4 flex items-center gap-3 rounded-[22px] px-4 py-4 text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-gold-500">
              <Users size={20} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Join Community</p>
              <p className="truncate text-xs text-white/45">Challenges, watch parties &amp; creators</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-gold-300/70" />
          </button>

          <div ref={sentinelRef} className="h-12" />
          {loading && (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
            </div>
          )}
        </div>
      </div>

      {fullscreenIndex !== null && (
        <FullscreenFeed
          videos={videos}
          slides={fullscreenSlides}
          startIndex={fullscreenIndex}
          onClose={() => setFullscreenIndex(null)}
          muted={muted}
          setMuted={setMuted}
          onUpdate={updateVideo}
          showGuestPrompt={() => {
            trackGuestInteraction();
            setGuestPromptContext('interaction');
            setShowGuestPrompt(true);
          }}
        />
      )}

      {showGuestPrompt && (
        <GuestPrompt onClose={() => setShowGuestPrompt(false)} context={guestPromptContext} />
      )}
      {showStoryCreator && (
        <StoryCreator onClose={() => setShowStoryCreator(false)} onPosted={() => setShowStoryCreator(false)} />
      )}
      </div>
    </div>
  );
}

export default Home;
