/** Helpers for admin-managed tailored ads in the main feed. */

export function filterAdsByPlacement(ads = [], placement) {
  return ads.filter(
    (ad) => ad.isActive && (ad.placement === placement || ad.placement === 'all')
  );
}

export function mixAdsIntoFeed(items = [], ads = [], { interval = 4 } = {}) {
  const pool = [...ads].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  if (!pool.length || !items.length) return items;

  const result = [...items];
  let poolIdx = 0;

  for (let i = interval; i < result.length && poolIdx < pool.length * 3; i += interval + 1) {
    const ad = pool[poolIdx % pool.length];
    result.splice(i, 0, { type: 'ad', data: ad, createdAt: ad.createdAt });
    poolIdx += 1;
  }

  return result;
}

export function mixAdsIntoSlides(slides = [], ads = [], { interval = 6 } = {}) {
  const pool = filterAdsByPlacement(ads, 'feed');
  if (!pool.length || !slides.length) return slides;

  const sorted = [...pool].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const result = [...slides];
  let poolIdx = 0;

  for (let i = interval; i < result.length && poolIdx < sorted.length * 3; i += interval + 1) {
    const ad = sorted[poolIdx % sorted.length];
    result.splice(i, 0, { type: 'ad', data: ad });
    poolIdx += 1;
  }

  return result;
}

export function adSlideKey(ad) {
  return `ad-${ad.id}`;
}

export function findSlideIndex(slides, item, type = 'video') {
  if (!item) return 0;
  if (type === 'ad') {
    return slides.findIndex((s) => s.type === 'ad' && s.data.id === item.id);
  }
  const videoId = item.id;
  return slides.findIndex((s) => s.type === 'video' && s.data.id === videoId);
}
