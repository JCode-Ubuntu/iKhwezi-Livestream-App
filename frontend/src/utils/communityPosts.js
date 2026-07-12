import { resolveMediaUrl } from '../config/appConfig';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)$/i;

/** Detect whether a feed item is an image post (v3 image uploads use Video rows). */
export function isImagePost(item) {
  if (!item) return false;
  if (item.mediaType === 'image') return true;
  if (item.type === 'image') return true;
  const name = item.filename || item.mediaUrl || item.url || '';
  if (IMAGE_EXT.test(name)) return true;
  if (VIDEO_EXT.test(name)) return false;
  if (item.duration === 0 || item.duration == null) {
    return IMAGE_EXT.test(name) || (!VIDEO_EXT.test(name) && !!name);
  }
  return false;
}

export function mediaUrl(item) {
  const file = item.filename || item.mediaUrl || item.url;
  return resolveMediaUrl(file);
}

export function thumbnailUrl(item) {
  if (item.thumbnail) return resolveMediaUrl(item.thumbnail);
  return mediaUrl(item);
}

/** Normalize video / image feed rows into a community grid post. */
export function normalizeCommunityPost(item) {
  const image = isImagePost(item);
  return {
    id: item.id,
    type: image ? 'image' : 'video',
    thumbnailUrl: thumbnailUrl(item),
    mediaUrl: mediaUrl(item),
    creator: item.creator || item.author || null,
    starCount: item.starCount ?? item.likeCount ?? 0,
    viewCount: item.views ?? 0,
    isTrending: !!(item.isTrending || item.isSponsored),
    isAd: !!item.isAd,
    adId: item.adId,
    caption: item.caption,
    createdAt: item.createdAt,
    carouselCover: item.carouselCover || null,
    raw: item.raw || item,
  };
}

const shownSets = new WeakMap();

export function pickCommunityBatch(pool, maxCards = 3, sessionKey = 'default') {
  if (!pool?.length) return [];

  let shown = shownSets.get(sessionKey);
  if (!shown) {
    shown = new Set();
    shownSets.set(sessionKey, shown);
  }

  let available = pool.filter((p) => !shown.has(p.id));
  if (available.length < maxCards) {
    shown.clear();
    available = [...pool];
  }

  const picked = [];
  const take = (list) => {
    const item = list.find((p) => !picked.some((x) => x.id === p.id));
    if (item) {
      picked.push(item);
      shown.add(item.id);
    }
  };

  const trending = available.filter((p) => p.isTrending);
  if (trending.length) take(trending.sort(() => Math.random() - 0.5));

  const newest = [...available].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
  newest.forEach((p) => {
    if (picked.length < maxCards) take([p]);
  });

  const rest = available.filter((p) => !picked.some((x) => x.id === p.id));
  while (picked.length < maxCards && rest.length) {
    const i = Math.floor(Math.random() * rest.length);
    take([rest.splice(i, 1)[0]]);
  }

  return picked.slice(0, maxCards);
}

const preloadCache = new Map();

export function preloadCommunityThumbnails(posts = []) {
  return Promise.all(
    posts.map((post) => {
      const url = post.thumbnailUrl || post.mediaUrl;
      if (!url || preloadCache.has(url)) return Promise.resolve();
      return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          preloadCache.set(url, true);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    })
  );
}
