import React, { useState, useEffect, useCallback } from 'react';
import { Play, Eye, Clapperboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UltimaField from '../ultima/UltimaField';
import { UltimaCrown } from '../ultima/UltimaPrimitives';
import SkeletonStream from '../components/SkeletonStream';
import FullscreenFeed from '../components/feed/FullscreenFeed';

function formatCount(count) {
  if (!count) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return `${count}`;
}

function ReelTile({ video, index, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ik-tap-spring ultima-glass-supreme group relative w-full overflow-hidden rounded-[20px]"
      style={{ aspectRatio: '9 / 16', animationDelay: `${(index % 12) * 40}ms` }}
    >
      <video
        src={`/storage/uploads/${video.filename}`}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        muted
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
      <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
        <Play size={16} className="fill-white text-white" />
      </div>
      <div className="absolute bottom-2 left-2 right-2">
        <p className="truncate text-[11px] font-semibold text-white">@{video.creator?.username || 'unknown'}</p>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/70">
          <Eye size={10} />
          {formatCount(video.views)}
        </div>
      </div>
    </button>
  );
}

function Reels() {
  const { fetchWithAuth } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fullscreenIndex, setFullscreenIndex] = useState(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth('/videos/feed?page=1&limit=40');
        const data = await res.json();
        setVideos(data.videos || []);
      } catch (err) {
        console.error('Failed to load reels', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchWithAuth]);

  const updateVideo = useCallback((updated) => {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <UltimaField intensity={0.75} fixed />
      <div className="ultima-page ultima-scroll ultima-content">
        <header className="px-5 pb-3 pt-6">
          <p className="ultima-eyebrow">Vertical · Cinema</p>
          <div className="mt-1 flex items-center gap-2">
            <Clapperboard size={22} className="text-pink-400" />
            <h1 className="ultima-text-supreme font-display text-3xl font-black tracking-tight">
              Reels
            </h1>
          </div>
        </header>

        <div className="mb-2 px-5">
          <UltimaCrown label="For You" />
        </div>

        {loading ? (
          <SkeletonStream rows={5} />
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
            <Clapperboard className="h-10 w-10 text-white/25" />
            <p className="text-sm text-white/45">No reels yet. Be the first to post one.</p>
          </div>
        ) : (
          <div className="ultima-stagger grid grid-cols-3 gap-1.5 px-3 pb-24 pt-1">
            {videos.map((video, index) => (
              <ReelTile key={video.id} video={video} index={index} onClick={() => setFullscreenIndex(index)} />
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
            showTrackMeta
          />
        )}
      </div>
    </div>
  );
}

export default Reels;
