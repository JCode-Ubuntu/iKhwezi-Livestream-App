// Premium CSS filter presets for the photo/video editor — applied live to
// the preview element. Lightweight, GPU-accelerated, no re-encoding needed.
export const FILTER_PRESETS = [
  { id: 'none', label: 'Original', css: 'none' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.18) brightness(0.96)' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.65) contrast(1.12) brightness(1.02)' },
  { id: 'golden', label: 'Golden Hour', css: 'sepia(0.32) saturate(1.35) brightness(1.05) hue-rotate(-6deg)' },
  { id: 'cool', label: 'Cool Blue', css: 'saturate(1.2) hue-rotate(15deg) brightness(1.02) contrast(1.05)' },
  { id: 'fade', label: 'Fade', css: 'contrast(0.88) brightness(1.1) saturate(0.82)' },
  { id: 'rose', label: 'Rosé', css: 'saturate(1.25) sepia(0.12) hue-rotate(-10deg) brightness(1.04)' },
];
