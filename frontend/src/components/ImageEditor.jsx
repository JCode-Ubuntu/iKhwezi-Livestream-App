import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Sliders, Palette, Type, Smile, RotateCcw } from 'lucide-react';
import { FILTER_PRESETS } from '../utils/filterPresets';

const STICKERS = ['✨', '🔥', '💎', '👑', '🌹', '💫', '⭐', '💖', '🎬', '🌙'];
const TEXT_COLORS = ['#ffffff', '#E1306C', '#F5C542', '#22D3EE', '#000000'];

// A single professional-grade image editor: pan/zoom crop within a fixed
// aspect frame, filter presets, brightness/contrast/saturation sliders, and
// draggable text/sticker overlays. Renders everything to a canvas on save.
function ImageEditor({ src, aspect = 1, title = 'Edit photo', onCancel, onSave }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  const [filterId, setFilterId] = useState('none');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const [tab, setTab] = useState('crop'); // crop | filter | adjust | text
  const [overlays, setOverlays] = useState([]); // { id, text, x, y, color, size }
  const overlayDragRef = useRef(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
    };
    img.src = src;
  }, [src]);

  const filterString = useCallback(() => {
    const preset = FILTER_PRESETS.find((f) => f.id === filterId);
    const presetCss = preset && preset.css !== 'none' ? preset.css : '';
    return `${presetCss} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`.trim();
  }, [filterId, brightness, contrast, saturation]);

  const onPointerDownFrame = (e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, offsetX: offset.x, offsetY: offset.y };
  };
  const onPointerMoveFrame = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.offsetX + dx, y: dragRef.current.offsetY + dy });
  };
  const onPointerUpFrame = () => { dragRef.current = null; };

  const onWheelFrame = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(1, z + (e.deltaY > 0 ? -0.08 : 0.08))));
  };

  const addSticker = (char) => {
    setOverlays((prev) => [...prev, { id: `s${Date.now()}`, text: char, x: 50, y: 50, color: '#ffffff', size: 48 }]);
  };
  const addText = () => {
    setOverlays((prev) => [...prev, { id: `t${Date.now()}`, text: 'Tap to edit', x: 50, y: 50, color: '#ffffff', size: 28, editable: true }]);
  };
  const updateOverlay = (id, patch) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };
  const removeOverlay = (id) => setOverlays((prev) => prev.filter((o) => o.id !== id));

  const onOverlayPointerDown = (e, ov) => {
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    overlayDragRef.current = { id: ov.id, rect };
  };
  const onOverlayPointerMove = (e) => {
    if (!overlayDragRef.current) return;
    const { id, rect } = overlayDragRef.current;
    const x = Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(96, Math.max(4, ((e.clientY - rect.top) / rect.height) * 100));
    updateOverlay(id, { x, y });
  };
  const onOverlayPointerUp = () => { overlayDragRef.current = null; };

  const handleSave = async () => {
    if (!imgLoaded) return;
    setSaving(true);
    try {
      const rect = containerRef.current.getBoundingClientRect();
      const outW = 1080;
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.filter = filterString();

      // Map the on-screen pan/zoom transform onto the output canvas.
      const scaleX = outW / rect.width;
      const scaleY = outH / rect.height;
      const drawW = naturalSize.w * (rect.width / naturalSize.w) * zoom;
      const drawH = naturalSize.h * (rect.height / naturalSize.h) * zoom;
      // Base fit: cover the frame, then apply user pan/zoom on top.
      const baseScale = Math.max(rect.width / naturalSize.w, rect.height / naturalSize.h);
      const fitW = naturalSize.w * baseScale * zoom;
      const fitH = naturalSize.h * baseScale * zoom;
      const cx = rect.width / 2 + offset.x;
      const cy = rect.height / 2 + offset.y;
      const drawX = (cx - fitW / 2) * scaleX;
      const drawY = (cy - fitH / 2) * scaleY;

      ctx.drawImage(imgRef.current, drawX, drawY, fitW * scaleX, fitH * scaleY);
      ctx.filter = 'none';

      overlays.forEach((ov) => {
        ctx.save();
        ctx.font = `${ov.size * (outW / rect.width)}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = ov.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 8;
        ctx.fillText(ov.text, (ov.x / 100) * outW, (ov.y / 100) * outH);
        ctx.restore();
      });

      canvas.toBlob((blob) => {
        setSaving(false);
        if (blob) onSave(blob);
      }, 'image/jpeg', 0.92);
    } catch (err) {
      console.error('Image editor save failed:', err);
      setSaving(false);
    }
  };

  const previewStyle = imgLoaded ? {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    filter: filterString(),
    pointerEvents: 'none',
  } : { display: 'none' };

  return (
    // Solid background — same reasoning as ProfileEditSheet: this dialog can be
    // opened while a page with colorful content (cover photo, gradients) is
    // still mounted behind it, and any transparency + blur here lets that
    // content show through as a hazy silhouette instead of a clean black canvas.
    <div className="fixed inset-0 z-[350] flex flex-col bg-void-950" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3">
        <button type="button" onClick={onCancel} className="ik-btn ik-btn-ghost flex h-9 w-9 items-center justify-center !p-0">
          <X size={18} />
        </button>
        <span className="text-sm font-bold text-white">{title}</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!imgLoaded || saving}
          className="ik-btn ik-btn-primary ik-btn-sm ik-btn-pill flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check size={14} />
          {saving ? 'Saving…' : 'Done'}
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <div
          ref={containerRef}
          className="relative touch-none overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl"
          style={{
            width: aspect >= 1 ? 'min(88vw, 480px)' : `min(70vw, ${480 * aspect}px)`,
            aspectRatio: `${aspect}`,
            cursor: tab === 'crop' ? 'grab' : 'default',
          }}
          onPointerDown={tab === 'crop' ? onPointerDownFrame : undefined}
          onPointerMove={(e) => { onPointerMoveFrame(e); onOverlayPointerMove(e); }}
          onPointerUp={() => { onPointerUpFrame(); onOverlayPointerUp(); }}
          onPointerLeave={() => { onPointerUpFrame(); onOverlayPointerUp(); }}
          onWheel={tab === 'crop' ? onWheelFrame : undefined}
        >
          <img ref={imgRef} src={src} alt="" style={previewStyle} draggable={false} />
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400/40 border-t-gold-400" />
            </div>
          )}
          {overlays.map((ov) => (
            <div
              key={ov.id}
              onPointerDown={(e) => onOverlayPointerDown(e, ov)}
              onDoubleClick={() => removeOverlay(ov.id)}
              className="absolute select-none"
              style={{
                left: `${ov.x}%`,
                top: `${ov.y}%`,
                transform: 'translate(-50%, -50%)',
                color: ov.color,
                fontSize: ov.size,
                fontWeight: 700,
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                cursor: 'move',
                whiteSpace: 'nowrap',
              }}
              title="Drag to move · double-tap to remove"
            >
              {ov.text}
            </div>
          ))}
          {tab === 'crop' && imgLoaded && (
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25" />
          )}
        </div>
      </div>

      {/* Tool tabs — fixed 5-column grid (not a centered flex row) so all five
          tabs always fit within the viewport on narrow phones instead of
          overflowing and clipping the first/last item off-screen. */}
      <div className="grid grid-cols-5 gap-0.5 px-2 pb-2">
        {[
          { id: 'crop', icon: RotateCcw, label: 'Crop' },
          { id: 'filter', icon: Palette, label: 'Filters' },
          { id: 'adjust', icon: Sliders, label: 'Adjust' },
          { id: 'text', icon: Type, label: 'Text' },
          { id: 'sticker', icon: Smile, label: 'Stickers' },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`ik-btn flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-semibold uppercase tracking-wide ${
                tab === t.id ? 'bg-gradient-to-br from-pink-500/20 to-gold-500/15 text-gold-200' : 'text-white/50'
              }`}
            >
              <Icon size={16} />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tool panel */}
      <div
        className="border-t border-white/10 bg-black/90 px-4 py-4"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {tab === 'crop' && (
          <p className="text-center text-xs text-white/40">Drag to reposition · scroll or pinch to zoom</p>
        )}

        {tab === 'filter' && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {FILTER_PRESETS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterId(f.id)}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <div
                  className="h-14 w-14 overflow-hidden rounded-xl border-2 bg-cover bg-center"
                  style={{
                    borderColor: filterId === f.id ? '#E1306C' : 'rgba(255,255,255,0.15)',
                    backgroundImage: `url(${src})`,
                    filter: f.css === 'none' ? 'none' : f.css,
                  }}
                />
                <span className={`text-[10px] ${filterId === f.id ? 'text-pink-300' : 'text-white/50'}`}>{f.label}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'adjust' && (
          <div className="flex flex-col gap-4">
            {[
              { label: 'Brightness', value: brightness, set: setBrightness, min: 50, max: 150 },
              { label: 'Contrast', value: contrast, set: setContrast, min: 50, max: 150 },
              { label: 'Saturation', value: saturation, set: setSaturation, min: 0, max: 200 },
            ].map((s) => (
              <div key={s.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
                  <span>{s.label}</span>
                  <span className="text-gold-300">{s.value}%</span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={s.value}
                  onChange={(e) => s.set(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>
            ))}
          </div>
        )}

        {tab === 'text' && (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={addText} className="ik-btn ik-btn-secondary ik-btn-sm ik-btn-pill self-center px-5">
              + Add text
            </button>
            <div className="flex justify-center gap-2">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    const last = overlays[overlays.length - 1];
                    if (last) updateOverlay(last.id, { color: c });
                  }}
                  className="h-7 w-7 rounded-full border-2 border-white/20"
                  style={{ background: c }}
                />
              ))}
            </div>
            <p className="text-center text-[11px] text-white/35">Double-tap any overlay to remove it</p>
          </div>
        )}

        {tab === 'sticker' && (
          <div className="flex flex-wrap justify-center gap-2">
            {STICKERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSticker(s)}
                className="ik-btn-bouncy flex h-11 w-11 items-center justify-center rounded-xl bg-white/6 text-2xl"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageEditor;
