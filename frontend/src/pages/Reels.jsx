import React, { useState, useEffect, useCallback } from 'react';
import { Clapperboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SkeletonStream from '../components/SkeletonStream';
import FullscreenFeed from '../components/feed/FullscreenFeed';
import GuestPrompt from '../components/GuestPrompt';

function Reels() {
  const { fetchWithAuth, trackGuestInteraction } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  const loadReels = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetchWithAuth('/videos/feed?page=1&limit=40');
      if (!res.ok) throw new Error(`Reels request failed: ${res.status}`);
      const data = await res.json();
      setVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (err) {
      console.error('Failed to load reels', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadReels(); }, [loadReels]);

  const updateVideo = useCallback((updated) => {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }, []);

  if (loading) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-void-950">
        <div className="ultima-page ultima-content flex min-h-0 flex-1 flex-col justify-center px-5">
          <SkeletonStream rows={5} />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-void-950">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Clapperboard className="h-10 w-10 text-white/25" />
          <p className="text-sm text-white/45">Couldn&apos;t load reels. Check your connection.</p>
          <button type="button" onClick={loadReels} className="ik-btn ik-btn-secondary ik-btn-sm ik-btn-pill px-5">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-void-950">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Clapperboard className="h-10 w-10 text-white/25" />
          <p className="text-sm text-white/45">No reels yet. Be the first to post one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-void-950">
      <FullscreenFeed
        embedded
        videos={videos}
        startIndex={0}
        onClose={() => {}}
        muted={muted}
        setMuted={setMuted}
        onUpdate={updateVideo}
        showTrackMeta
        showGuestPrompt={() => {
          trackGuestInteraction();
          setShowGuestPrompt(true);
        }}
      />
      {showGuestPrompt && (
        <GuestPrompt onClose={() => setShowGuestPrompt(false)} context="interaction" />
      )}
    </div>
  );
}

export default Reels;
