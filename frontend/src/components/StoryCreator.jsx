import React, { useState, useRef } from 'react';
import { X, Camera, Upload, ArrowLeft, Send, Image, Video, Wand2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FILTER_PRESETS } from '../utils/filterPresets';
import ImageEditor from './ImageEditor';

export default function StoryCreator({ onClose, onPosted }) {
  const { fetchWithAuth, showToast } = useAuth();
  const [mode, setMode] = useState('select'); // select | preview | editing
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileType, setFileType] = useState('image'); // 'image' | 'video'
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [filterId, setFilterId] = useState('none');
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const activeFilter = FILTER_PRESETS.find((f) => f.id === filterId) || FILTER_PRESETS[0];

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVid = f.type.startsWith('video/');
    const isImg = f.type.startsWith('image/');
    if (!isVid && !isImg) {
      showToast('Only images and videos are supported', 'error');
      return;
    }
    if (isImg) {
      const reader = new FileReader();
      reader.onload = () => {
        setRawImageSrc(reader.result);
        setFileType('image');
        setMode('editing');
      };
      reader.readAsDataURL(f);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setFileType('video');
    setMode('preview');
  };

  const handleEditorSave = (blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const editedFile = new File([blob], 'story.jpg', { type: 'image/jpeg' });
    setFile(editedFile);
    setPreviewUrl(URL.createObjectURL(blob));
    setRawImageSrc(null);
    setMode('preview');
  };

  const handlePost = async () => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('ikhwezi_token');
      const formData = new FormData();
      formData.append('story', file);
      formData.append('caption', caption.trim());

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      showToast('Story posted! Disappears in 24h ✨', 'success');
      onPosted?.();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to post story', 'error');
    } finally {
      setUploading(false);
    }
  };

  const goBack = () => {
    if (mode === 'preview') {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(null);
      setPreviewUrl(null);
      setCaption('');
      setFilterId('none');
      setMode('select');
    } else if (mode === 'editing') {
      setRawImageSrc(null);
      setMode('select');
    } else {
      onClose();
    }
  };

  if (mode === 'editing' && rawImageSrc) {
    return (
      <ImageEditor
        src={rawImageSrc}
        aspect={9 / 16}
        title="Edit your story"
        onCancel={goBack}
        onSave={handleEditorSave}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black/85 backdrop-blur-xl"
      style={{ paddingBottom: 'max(0px,env(safe-area-inset-bottom))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition active:scale-95"
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          title={mode === 'preview' ? 'Back' : 'Close'}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 18 }}>✨</span>
          <span className="text-sm font-bold text-white">New Story</span>
        </div>
        {mode === 'preview' ? (
          <button
            type="button"
            onClick={handlePost}
            disabled={uploading}
            className="ultima-btn-supreme flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm disabled:opacity-40"
          >
            {uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send size={14} />
            )}
            {uploading ? 'Posting…' : 'Share'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition active:scale-95"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Body */}
      {mode === 'select' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-[26px]"
              style={{ background: 'linear-gradient(135deg, #F5C542, #E1306C)', boxShadow: '0 10px 40px rgba(225,48,108,0.35)' }}
            >
              <span style={{ fontSize: 36 }}>✨</span>
            </div>
            <h2 className="font-display text-2xl font-black text-white">Add a Story</h2>
            <p className="text-sm text-white/50">Share a moment — disappears after 24 hours</p>
          </div>

          <div className="flex w-full max-w-xs flex-col gap-3">
            {/* Camera capture */}
            <label className="ultima-glass ik-tap-spring flex cursor-pointer items-center justify-center gap-3 rounded-2xl px-5 py-4 font-semibold text-white">
              <Camera size={22} className="text-gold-400" />
              <div className="text-left">
                <p className="text-sm font-bold">Take a Photo / Video</p>
                <p className="text-xs text-white/40">Use your camera</p>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>

            {/* Gallery pick */}
            <label className="ultima-glass ik-tap-spring flex cursor-pointer items-center justify-center gap-3 rounded-2xl px-5 py-4 font-semibold text-white">
              <Upload size={22} className="text-pink-400" />
              <div className="text-left">
                <p className="text-sm font-bold">Choose from Gallery</p>
                <p className="text-xs text-white/40">Upload a photo or video</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        </div>
      )}

      {mode === 'preview' && previewUrl && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Media preview */}
          <div className="relative flex flex-1 items-center justify-center bg-black overflow-hidden">
            {fileType === 'video' ? (
              <video
                src={previewUrl}
                className="max-h-full max-w-full object-contain"
                style={{ filter: activeFilter.css }}
                controls
                playsInline
                autoPlay
                muted
              />
            ) : (
              <img
                src={previewUrl}
                alt="Story preview"
                className="max-h-full max-w-full object-contain"
              />
            )}
            {/* Type badge */}
            <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {fileType === 'video' ? <Video size={12} /> : <Image size={12} />}
              {fileType === 'video' ? 'Video' : 'Photo'}
            </div>
            {/* 24h badge */}
            <div className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-gold-500 to-pink-500 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              24h
            </div>
            {fileType === 'image' && (
              <button
                type="button"
                onClick={() => { setRawImageSrc(previewUrl); setMode('editing'); }}
                className="ik-btn ik-btn-secondary absolute bottom-3 right-3 flex items-center gap-1.5 !py-2 !px-3.5 text-xs"
              >
                <Wand2 size={13} />
                Edit
              </button>
            )}
          </div>

          {/* Filter presets — video only; photos are edited (filters/adjustments/crop/stickers) via ImageEditor above */}
          {fileType === 'video' && (
          <div className="border-t border-white/10 bg-black/90 px-4 pt-3">
            <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {FILTER_PRESETS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterId(f.id)}
                  className="ik-tap-spring flex shrink-0 flex-col items-center gap-1.5"
                >
                  <span
                    className="h-11 w-11 rounded-2xl border-2"
                    style={{
                      filter: f.css,
                      background: 'linear-gradient(135deg,#E1306C,#F5C542)',
                      borderColor: filterId === f.id ? '#E1306C' : 'transparent',
                      boxShadow: filterId === f.id ? '0 0 0 1px rgba(225,48,108,0.5), 0 0 16px rgba(225,48,108,0.35)' : 'none',
                    }}
                  />
                  <span className={`text-[9px] font-medium ${filterId === f.id ? 'text-pink-300' : 'text-white/50'}`}>
                    {f.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Caption input */}
          <div className="border-t border-white/10 bg-black/95 px-4 py-3">
            <input
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value.slice(0, 150))}
              placeholder="Add a caption… (optional)"
              className="ultima-input w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35"
              maxLength={150}
            />
            {caption && (
              <p className="mt-1 text-right text-xs text-white/30">{caption.length}/150</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
