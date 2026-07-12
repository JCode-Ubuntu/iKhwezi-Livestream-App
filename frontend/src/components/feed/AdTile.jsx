import React from 'react';
import { Megaphone, ExternalLink } from 'lucide-react';
import { resolveMediaUrl } from '../../config/appConfig';

export default function AdTile({ ad, tall, index, onClick }) {
  const isVideo = ad.mediaType === 'video';

  return (
    <button
      type="button"
      onClick={onClick}
      className="ultima-bento-card ultima-glass-supreme group relative w-full overflow-hidden rounded-[26px] ring-1 ring-gold-400/25"
      style={{ height: tall ? 280 : 220, animationDelay: `${index * 60}ms` }}
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
      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-gold-400/35 bg-black/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-200 backdrop-blur-sm">
        <Megaphone size={10} />
        Sponsored
      </div>
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
    </button>
  );
}
