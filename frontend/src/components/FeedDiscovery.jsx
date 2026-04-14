import React, { useMemo, useState } from 'react';
import { Flame, Globe2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import GlassCard from './GlassCard';

/**
 * Trending + Global Pulse carousels — collapsible so they never block the video.
 */
function FeedDiscovery({ videos, currentIndex, onPickIndex, fashionTag = 'default' }) {
  const [expanded, setExpanded] = useState(false);

  const trending = useMemo(
    () =>
      [...videos]
        .filter((v) => v.isTrending)
        .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0)),
    [videos]
  );

  const globalPulse = useMemo(() => {
    const pool = trending.length ? trending : [...videos];
    return [...pool]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 12);
  }, [videos, trending]);

  const halo =
    fashionTag === 'fashion'
      ? 'from-fuchsia-500/20 via-transparent to-cyan-400/15'
      : 'from-indigo-500/15 via-transparent to-purple-500/10';

  if (!videos.length) return null;

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-[2] flex flex-col items-end px-3 pt-3">
      {/* Collapsed pill — always visible, tapping expands the panel */}
      <button
        type="button"
        className="pointer-events-auto mb-1 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-xl transition-transform active:scale-95"
        onClick={() => setExpanded((v) => !v)}
        style={{ boxShadow: '0 2px 16px rgba(99,102,241,0.18)' }}
      >
        <Sparkles className="h-3 w-3 text-neon-cyan" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">For You</span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-white/50" />
        ) : (
          <ChevronDown className="h-3 w-3 text-white/50" />
        )}
      </button>

      {/* Expandable panel */}
      {expanded && (
        <div
          className={`pointer-events-auto w-full rounded-3xl bg-gradient-to-br ${halo} p-0.5`}
          style={{ animation: 'fadeSlideDown 0.18s ease-out' }}
        >
          <GlassCard className="!rounded-[22px] !bg-black/70 !shadow-none">
            <div className="px-2 pb-2 pt-2">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                Trending
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(trending.length ? trending : videos.slice(0, 8)).map((v) => {
                  const idx = videos.findIndex((x) => x.id === v.id);
                  const active = idx === currentIndex;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { idx >= 0 && onPickIndex(idx); setExpanded(false); }}
                      className={`relative flex-shrink-0 overflow-hidden rounded-2xl border transition-all active:scale-95 ${
                        active ? 'border-neon-indigo shadow-neon-ring scale-105' : 'border-white/10 hover:border-white/25'
                      }`}
                      style={{ width: 56, height: 72 }}
                    >
                      <video src={`/storage/uploads/${v.filename}`} className="h-full w-full object-cover" muted playsInline />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <span className="absolute bottom-1 left-1 right-1 truncate text-[9px] font-medium text-white/90">
                        @{v.creator?.username}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
                <Globe2 className="h-3.5 w-3.5 text-neon-cyan" />
                Global Pulse
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {globalPulse.map((v) => {
                  const idx = videos.findIndex((x) => x.id === v.id);
                  const active = idx === currentIndex;
                  return (
                    <button
                      key={`gp-${v.id}`}
                      type="button"
                      onClick={() => { idx >= 0 && onPickIndex(idx); setExpanded(false); }}
                      className={`relative flex-shrink-0 overflow-hidden rounded-2xl border transition-all active:scale-95 ${
                        active ? 'border-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,0.35)]' : 'border-white/10'
                      }`}
                      style={{ width: 56, height: 72 }}
                    >
                      <video src={`/storage/uploads/${v.filename}`} className="h-full w-full object-cover" muted playsInline />
                      <div className="absolute left-1 top-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[8px] font-bold text-neon-cyan">
                        {(v.views || 0) > 999 ? `${((v.views || 0) / 1000).toFixed(1)}k` : v.views || 0} views
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    </button>
                  );
                })}
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

export default React.memo(FeedDiscovery);
