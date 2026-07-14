import React from 'react';
import { resolveMediaUrl } from '../config/appConfig';

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

export function isVideoFile(filename) {
  return VIDEO_EXT.test(filename || '');
}

/**
 * Renders an image or muted video preview based on the media filename/URL.
 * Seed/demo posts are often JPEGs — using <video> for those shows blank tiles.
 */
export default function MediaPreview({
  filename,
  className = '',
  style,
  autoPlay = false,
  loop = false,
  muted = true,
  playsInline = true,
  preload = 'metadata',
  alt = '',
}) {
  const src = resolveMediaUrl(filename);
  if (!src) {
    return <div className={className} style={style} aria-hidden="true" />;
  }

  if (isVideoFile(src)) {
    return (
      <video
        src={src}
        className={className}
        style={style}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        preload={preload}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      draggable={false}
    />
  );
}
