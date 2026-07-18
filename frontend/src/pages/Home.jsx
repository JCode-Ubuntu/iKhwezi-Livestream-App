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
import { Play, Orbit, Eye, Sparkles, Users, ChevronRight } from 'lucide-react';
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

        <div className={`absolute bottom-0 left-0 right-0 ${compact ? 'p-2.5' : 'p-6'}`}>
          <p className={`font-display font-medium uppercase tracking-[0.18em] text-plasma-300/75 ${
            compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'
          }`}>
            @{v.creator?.username || 'signal'}
          </p>
          {v.caption && (
            <h2
              className={`ultima-text-glow mt-0.5 font-display font-black leading-snug text-white ${
                compact ? 'line-clamp-1 text-sm' : 'mt-2 text-2xl sm:text-3xl'
              }`}
            >
              {v.caption}
            </h2>
          )}
          <div className={`flex items-center justify-between gap-2 ${compact ? 'mt-1.5' : 'mt-4'}`}>
            <div className={`flex gap-2 text-white/45 ${compact ? 'text-[9px]' : 'text-[10px] sm:text-xs'}`}>
              <span>{v.likeCount || 0}</span>
              <span className="inline-flex items-center gap-0.5">
                <Eye size={10} />
                {v.views || 0}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpen(idx)}
              className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-amber-500 text-void-950 shadow-lg shadow-gold-500/35 transition active:scale-95 ${
                compact ? 'h-9 w-9' : 'h-14 w-14'
              }`}
            >
              <Play size={compact ? 14 : 22} fill="currentColor" className="ml-0.5" />
            </button>
          </div>
          <div className={`flex justify-center gap-1 ${compact ? 'mt-1 hidden' : 'mt-4'}`}>
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

function LatestSignalsRow({ items, onOpen }) {
  const preview = items
    .filter((item) => item.type === 'video' || item.type === 'ad')
    .slice(0, 3);
  if (!preview.length) return null;

  return (
    <div className="home-latest-row h-full min-h-0 px-3">
      <div className="home-latest-grid">
        {preview.map((item, index) => {
          if (item.type === 'ad') {
            return (
              <AdTile
                key={`a-${item.data.id}`}
                ad={item.data}
                tall={false}
                compact
                index={index}
                onClick={() => onOpen(item.data, 'ad')}
              />
            );
          }
          return (
            <button
              key={`v-${item.data.id}`}
              type="button"
              onClick={() => onOpen(item.data, 'video')}
              className="home-latest-tile ultima-glass-supreme group relative overflow-hidden rounded-[14px]"
            >
              <MediaPreview
                filename={item.data.filename}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-active:scale-[1.03]"
                muted
                playsInline
                preload="metadata"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-void-950/85 via-transparent to-transparent" />
              <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[8px] font-semibold text-white/80">
                @{item.data.creator?.username || 'signal'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CommunitySignalsTeaser({ textPosts, onOpen }) {
  const messages = useMemo(() => {
    const fromPosts = (textPosts || [])
      .slice(0, 12)
      .map((p) => ({
        id: p.id,
        text: p.content || p.caption || p.title || '',
        username: p.author?.username || 'signal',
      }))
      .filter((m) => m.text.trim());
    if (fromPosts.length >= 2) return fromPosts;
    return [
      { id: 'demo-1', text: 'Argentina or Spain?', username: 'signal' },
      { id: 'demo-2', text: 'Remember to attend the next meeting on Wednesday! 👀😊', username: 'signal' },
      { id: 'demo-3', text: 'New challenges drop every week on Community', username: 'signal' },
      { id: 'demo-4', text: 'Tap to join Community Signals', username: 'ikhwezi' },
    ];
  }, [textPosts]);

  const visible = useMemo(() => messages.slice(0, 4), [messages]);
  const loop = useMemo(
    () => (messages.length > 4 ? [...messages, ...messages.slice(0, 2)] : visible),
    [messages, visible]
  );

  return (
    <button
      type="button"
      onClick={onOpen}
      className="home-community-teaser"
      aria-label="Open Community Signals"
    >
      <div
        className={`home-community-feed ${messages.length > 4 ? 'home-community-feed--drift' : ''}`}
        style={{ '--feed-count': String(messages.length) }}
      >
        {loop.map((msg, i) => (
          <div key={`${msg.id}-${i}`} className="home-community-feed-item">
            <p className="home-community-feed-text">{msg.text}</p>
            <span className="home-community-feed-handle">@{msg.username}</span>
          </div>
        ))}
      </div>
    </button>
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
  const { fetchWithAuth, isGuest, guestInteractions, trackGuestInteraction } = useAuth();
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
  const [textPreview, setTextPreview] = useState(null);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const loadingMore = useRef(false);
  const desktopSentinelRef = useRef(null);

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
      .then(async (r) => {
        if (!r.ok) return [];
        const data = await r.json();
        return Array.isArray(data) ? data : [];
      })
      .then((data) => setTextPosts(data))
      .catch(() => setTextPosts([]));
  }, [fetchWithAuth]);

  useEffect(() => {
    if (!desktopSentinelRef.current) return undefined;

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
    observer.observe(desktopSentinelRef.current);
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
      <div className="ultima-page ultima-content home-page-shell home-page-shell--locked">
      <header className="home-top-bar shrink-0 px-4 pb-0 pt-0 sm:px-5 sm:pb-3 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <img
            src={IKHWEZI_LOGO_URL}
            alt="iKhwezi"
            className="ultima-home-logo-image home-logo-compact sm:home-logo-full"
            width={148}
            height={148}
            decoding="async"
          />
          <div className="ultima-glass-supreme flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5">
            <Orbit size={13} className="text-pink-400" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70 sm:text-[10px]">
              {videos.length}
            </span>
          </div>
        </div>
      </header>

      <div className="home-stories-row shrink-0">
        <StoryTray compact hideLabels maxVisible={10} onAddStory={() => setShowStoryCreator(true)} />
      </div>

      <div className="home-feed-shell">
        <div className="home-spotlight-slot sm:hidden">
          <Spotlight
            compact
            videos={heroVideos.slice(0, 5)}
            muted={muted}
            onOpen={(heroIdx) => {
              const vid = heroVideos[heroIdx];
              openAt(vid);
            }}
          />
        </div>

        <div className="home-latest-slot sm:hidden">
          <LatestSignalsRow items={feedItems} onOpen={openAt} />
        </div>

        <div className="home-community-teaser-slot sm:hidden">
          <CommunitySignalsTeaser
            textPosts={textPosts}
            onOpen={() => navigate('/community')}
          />
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

          <div ref={desktopSentinelRef} className="h-12" />
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
      {textPreview && (
        <div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center"
          onClick={() => setTextPreview(null)}
          role="dialog"
          aria-modal
        >
          <div
            className="w-full max-w-md rounded-t-[28px] p-4 sm:rounded-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <TextPostCard
              post={textPreview}
              onOpenAuthor={(id) => {
                setTextPreview(null);
                if (id) navigate(`/profile/${id}`);
              }}
              onGuestBlock={() => {
                setTextPreview(null);
                setGuestPromptContext('interaction');
                setShowGuestPrompt(true);
              }}
            />
          </div>
        </div>
      )}
      {showStoryCreator && (
        <StoryCreator onClose={() => setShowStoryCreator(false)} onPosted={() => setShowStoryCreator(false)} />
      )}
      </div>
    </div>
  );
}

export default Home;
