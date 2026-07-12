import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GuestPrompt from '../components/GuestPrompt';
import { StoryTray } from '../components/Stories';
import StoryCreator from '../components/StoryCreator';
import SkeletonStream from '../components/SkeletonStream';
import FullscreenFeed from '../components/feed/FullscreenFeed';
import TextPostCard from '../components/feed/TextPostCard';
import CommunityContentGrid from '../components/CommunityContentGrid';
import UltimaField from '../ultima/UltimaField';
import { Play, Zap, Orbit, Eye, Sparkles, Send } from 'lucide-react';
import { resolveMediaUrl } from '../config/appConfig';

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return '0:00';
  const s = Math.max(0, Math.floor(Number(seconds)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Spotlight({ videos, muted, onOpen }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (videos.length < 2) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % videos.length), 5000);
    return () => clearInterval(t);
  }, [videos.length]);
  if (!videos.length) return null;
  const v = videos[idx];

  return (
    <section className="relative mx-4 mt-4 overflow-hidden rounded-[32px] ultima-spotlight-ring">
      <div className="relative aspect-[4/5] max-h-[58vh] w-full sm:aspect-video sm:max-h-[52vh]">
        <video
          key={v.id}
          src={resolveMediaUrl(v.filename)}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted={muted}
          loop
          playsInline
          style={{ filter: 'brightness(0.5) saturate(1.2)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-pink-700/25 via-transparent to-gold-900/20" />

        <div className="absolute left-5 top-5 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold-200">
            <Zap size={11} className="fill-gold-300 text-gold-300" />
            Spotlight
          </span>
          {v.isLive && (
            <span className="animate-pulse rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold text-white">
              LIVE
            </span>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <p className="font-display text-xs font-medium uppercase tracking-[0.25em] text-plasma-300/80">
            @{v.creator?.username || 'signal'}
          </p>
          {v.caption && (
            <h2 className="ultima-text-glow mt-2 font-display text-2xl font-black leading-tight text-white sm:text-3xl">
              {v.caption}
            </h2>
          )}
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex gap-4 text-xs text-white/50">
              <span>{v.likeCount || 0} stars</span>
              <span className="inline-flex items-center gap-1">
                <Eye size={12} />
                {v.views || 0}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpen(idx)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-amber-500 text-void-950 shadow-xl shadow-gold-500/40 transition active:scale-95"
            >
              <Play size={22} fill="currentColor" className="ml-0.5" />
            </button>
          </div>
          <div className="mt-4 flex justify-center gap-1.5">
            {videos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === idx ? 24 : 6,
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

function BentoTile({ video, tall, onClick, index }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ultima-bento-card ultima-glass-supreme group relative w-full overflow-hidden rounded-[26px]"
      style={{ height: tall ? 280 : 220, animationDelay: `${index * 60}ms` }}
    >
      <video
        src={resolveMediaUrl(video.filename)}
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
  const [textPosts, setTextPosts] = useState([]);
  const [loading, setLoading] = useState(true);
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
        setHasMore(!!data.hasMore);
      } catch (err) {
        console.error('Failed to load videos:', err);
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

  const heroVideos = useMemo(() => {
    const trending = videos.filter((v) => v.isTrending || v.isSponsored);
    return (trending.length >= 3 ? trending : videos).slice(0, 6);
  }, [videos]);

  const communityPool = useMemo(() => {
    const heroIds = new Set(heroVideos.map((v) => v.id));
    const rest = videos.filter((v) => !heroIds.has(v.id));
    return rest.length >= 3 ? rest : videos;
  }, [videos, heroVideos]);

  const feedItems = useMemo(() => {
    const heroIds = new Set(heroVideos.map((v) => v.id));
    const rest = videos.filter((v) => !heroIds.has(v.id)).map((v) => ({ type: 'video', data: v, createdAt: v.createdAt }));
    const posts = textPosts.map((p) => ({ type: 'text', data: p, createdAt: p.createdAt }));
    return [...rest, ...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [videos, heroVideos, textPosts]);

  const openAt = (video) => {
    const i = videos.findIndex((v) => v.id === video.id);
    setFullscreenIndex(i >= 0 ? i : 0);
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
      <div className="ultima-page ultima-scroll ultima-content">
      <header className="px-5 pb-3 pt-6">
        <p className="ultima-eyebrow">Supreme · Ultima</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="ultima-text-supreme font-display text-3xl font-black tracking-tight sm:text-4xl">
              iKHWEZI
            </h1>
            <p className="ultima-serif mt-1 text-base text-white/45">Shine the signal</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="ultima-glass-supreme flex items-center gap-2 rounded-full px-3.5 py-2">
              <Orbit size={14} className="text-pink-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                {videos.length} signals
              </span>
            </div>
            {isAuthenticated && !isGuest && (
              <button
                type="button"
                onClick={() => navigate('/messages')}
                aria-label="Messages"
                className="ultima-icon-btn ik-tap-spring flex h-10 w-10 items-center justify-center rounded-full text-white/75"
              >
                <Send size={17} strokeWidth={1.9} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="border-b border-white/5">
        <StoryTray onAddStory={() => setShowStoryCreator(true)} />
      </div>

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
        onPostClick={(post) => openAt(post.raw || post)}
        onRefresh={() => {
          if (hasMore && !loadingMore.current) {
            const next = page + 1;
            setPage(next);
            loadVideos(next, true);
          }
        }}
      />

      <div className="ultima-stagger grid grid-cols-2 gap-3 px-4 pt-6">
        {feedItems.map((item, index) =>
          item.type === 'video' ? (
            <BentoTile
              key={`v-${item.data.id}`}
              video={item.data}
              tall={index % 3 === 0}
              index={index}
              onClick={() => openAt(item.data)}
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

      <div ref={sentinelRef} className="h-12" />
      {loading && (
        <div className="flex justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      )}

      {fullscreenIndex !== null && (
        <FullscreenFeed
          videos={videos}
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
