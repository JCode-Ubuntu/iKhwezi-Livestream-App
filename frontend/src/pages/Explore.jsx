import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Play, Eye, TrendingUp, Hash, Radio, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UltimaField from '../ultima/UltimaField';
import SkeletonStream from '../components/SkeletonStream';
import FullscreenFeed from '../components/feed/FullscreenFeed';
import MediaPreview from '../components/MediaPreview';

function UserResultRow({ result, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(result.id)}
      className="ik-tap-spring ultima-glass flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
        style={{ background: result.avatar ? undefined : 'linear-gradient(135deg,#E1306C,#F5C542)' }}
      >
        {result.avatar ? (
          <img src={result.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          (result.username || '?').charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{result.displayName || result.username}</p>
        <p className="truncate text-xs text-white/45">@{result.username}</p>
      </div>
      {result.isCreator && (
        <span className="rounded-full border border-gold-400/30 bg-gold-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-300">
          Admin
        </span>
      )}
    </button>
  );
}

function DiscoveryTile({ video, index, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ik-tap-spring ultima-glass-supreme group relative aspect-square w-full overflow-hidden rounded-[20px]"
      style={{ animationDelay: `${(index % 12) * 40}ms` }}
    >
      <MediaPreview
        filename={video.filename}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        muted
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-semibold text-white/85">
        <Eye size={11} />
        {video.views || 0}
      </div>
      {(video.isTrending || video.isSponsored) && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500/90">
          <TrendingUp size={11} className="text-white" />
        </div>
      )}
    </button>
  );
}

function Explore() {
  const navigate = useNavigate();
  const { fetchWithAuth } = useAuth();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(null);
  const [muted, setMuted] = useState(true);
  const debounceRef = useRef(null);
  // Debounce only stops a *pending* (not-yet-fired) search from starting —
  // once the 300ms timeout fires and the fetch is in flight, typing again
  // starts a second fetch without cancelling the first. If that first,
  // now-stale request resolves after the second one (easily happens under
  // real network latency), it overwrote `users` with results for a query
  // the user has already changed. This ref tracks the latest query so a
  // late response can be dropped instead of applied.
  const latestQueryRef = useRef('');

  const loadDiscoveryFeed = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetchWithAuth('/videos/feed?page=1&limit=30');
      if (!res.ok) throw new Error(`Discovery feed request failed: ${res.status}`);
      const data = await res.json();
      setVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (err) {
      console.error('Failed to load discovery feed', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadDiscoveryFeed(); }, [loadDiscoveryFeed]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    latestQueryRef.current = trimmed;
    if (!trimmed) {
      setUsers([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`/users/search?q=${encodeURIComponent(trimmed)}&limit=20`);
        const data = await res.json();
        if (latestQueryRef.current !== trimmed) return;
        setUsers(Array.isArray(data) ? data : data.users || []);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        if (latestQueryRef.current === trimmed) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, fetchWithAuth]);

  const updateVideo = useCallback((updated) => {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }, []);

  const isSearchMode = query.trim().length > 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <UltimaField intensity={0.75} fixed />
      <div className="ultima-page ultima-scroll ultima-content">
        <header className="px-5 pb-3 pt-6">
          <p className="ultima-eyebrow">Discover</p>
          <h1 className="ultima-text-supreme mt-1 font-display text-3xl font-black tracking-tight">
            Explore
          </h1>

          <div className="ultima-input mt-4 flex items-center gap-3 rounded-2xl px-4 py-3">
            <Search size={17} className="shrink-0 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creators, usernames…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/30"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={16} className="text-white/40" />
              </button>
            )}
          </div>
        </header>

        {!isSearchMode && (
          <button
            type="button"
            onClick={() => navigate('/community')}
            className="ik-tap-spring ultima-glass-supreme mx-4 mb-4 mt-1 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-gold-500">
              <Hash size={18} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Challenges &amp; Watch Parties</p>
              <p className="truncate text-xs text-white/45">Start a trend or watch together, live</p>
            </div>
            <Radio size={13} className="text-pink-400" />
            <ChevronRight size={16} className="text-white/30" />
          </button>
        )}

        {isSearchMode ? (
          <div className="flex flex-col gap-2 px-4 pb-24 pt-2">
            {searching && (
              <p className="px-1 py-4 text-center text-sm text-white/40">Searching…</p>
            )}
            {!searching && users.length === 0 && (
              <p className="px-1 py-8 text-center text-sm text-white/40">No results for "{query}"</p>
            )}
            {users.map((u) => (
              <UserResultRow key={u.id} result={u} onOpen={(id) => navigate(`/profile/${id}`)} />
            ))}
          </div>
        ) : loading ? (
          <SkeletonStream rows={5} />
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
            <p className="text-sm text-white/45">Couldn't load discovery feed. Check your connection.</p>
            <button type="button" onClick={loadDiscoveryFeed} className="ik-btn ik-btn-secondary ik-btn-sm ik-btn-pill px-5">
              Retry
            </button>
          </div>
        ) : (
          <div className="ultima-stagger grid grid-cols-3 gap-1.5 px-3 pb-24 pt-2">
            {videos.map((video, index) => (
              <DiscoveryTile
                key={video.id}
                video={video}
                index={index}
                onClick={() => setFullscreenIndex(index)}
              />
            ))}
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
          />
        )}
      </div>
    </div>
  );
}

export default Explore;
