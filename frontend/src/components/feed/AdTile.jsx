import React from 'react';
import { Megaphone, ExternalLink } from 'lucide-react';
import { resolveMediaUrl } from '../../config/appConfig';

export default function AdTile({ ad, tall, index, onClick, compact = false }) {
  const isVideo = ad.mediaType === 'video';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`ultima-bento-card ultima-glass-supreme group relative w-full overflow-hidden ring-1 ring-gold-400/25 ${
        compact
          ? `home-masonry-tile rounded-[16px] ${tall ? 'home-masonry-tile--tall' : 'home-masonry-tile--short'}`
          : 'rounded-[26px]'
      }`}
      style={compact ? undefined : { height: tall ? 280 : 220, animationDelay: `${index * 60}ms` }}
    >
      {isVideo ? (
        <video
          src={resolveMediaUrl(ad.filename)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
        />
      ) : (
        <img
          src={resolveMediaUrl(ad.filename)}
          alt={ad.title || 'Sponsored'}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-void-950 via-void-950/25 to-transparent" />
      <div className={`absolute left-2 top-2 flex items-center gap-1 rounded-full border border-gold-400/35 bg-black/50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-gold-200 backdrop-blur-sm ${compact ? '' : 'left-3 top-3 px-2 text-[9px]'}`}>
        <Megaphone size={compact ? 8 : 10} />
        {!compact && 'Sponsored'}
      </div>
      {!compact && (
      <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
        <p className="truncate font-display text-xs font-semibold text-white">
          {ad.title || 'iKHWEZI'}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-white/55">
          {ad.caption || ad.ctaLabel || 'Tap to view'}
        </p>
        {ad.clickUrl && (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-gold-300/90">
            <ExternalLink size={9} />
            {ad.ctaLabel || 'Learn more'}
          </span>
        )}
      </div>
      )}
    </button>
  );
}
