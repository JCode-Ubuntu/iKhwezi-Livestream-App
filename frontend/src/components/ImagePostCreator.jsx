import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, ArrowLeft, Send, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../config/appConfig';
import ImageEditor from './ImageEditor';

export default function ImagePostCreator({ onClose, onPosted }) {
  const { showToast } = useAuth();
  const [mode, setMode] = useState('select');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const previewUrlRef = useRef(previewUrl);
  previewUrlRef.current = previewUrl;

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showToast('Only images are supported for feed posts', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setMode('editing');
    };
    reader.readAsDataURL(f);
  };

  const handleEditorSave = (blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const editedFile = new File([blob], 'post.jpg', { type: 'image/jpeg' });
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
      formData.append('image', file);
      formData.append('caption', caption.trim());

      const res = await fetch(`${getApiBase()}/v3/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      showToast('Image posted to your feed', 'success');
      onPosted?.();
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to post image', 'error');
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
        aspect={4 / 5}
        title="Edit your photo"
        onCancel={goBack}
        onSave={handleEditorSave}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black/85 backdrop-blur-xl"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-gold-400" />
          <span className="text-sm font-bold text-white">Upload Image</span>
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
            {uploading ? 'Posting…' : 'Post'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {mode === 'select' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-[26px]"
              style={{ background: 'linear-gradient(135deg, #F5C542, #E1306C)', boxShadow: '0 10px 40px rgba(225,48,108,0.35)' }}
            >
              <ImageIcon size={32} className="text-white" />
            </div>
            <h2 className="font-display text-2xl font-black text-white">Photo Signal</h2>
            <p className="text-sm text-white/50">Share a photo to your feed — stays on your profile</p>
          </div>

          <label className="ultima-glass ik-tap-spring flex w-full max-w-xs cursor-pointer items-center gap-3 rounded-2xl px-5 py-4 font-semibold text-white">
            <Upload size={22} className="text-pink-400" />
            <div className="text-left">
              <p className="text-sm font-bold">Choose from Gallery</p>
              <p className="text-xs text-white/40">JPG, PNG, or WebP</p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>
      )}

      {mode === 'preview' && previewUrl && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="relative flex flex-1 items-center justify-center bg-black">
            <img src={previewUrl} alt="Post preview" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="border-t border-white/10 bg-black/95 px-4 py-3">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 220))}
              placeholder="Add a caption… (optional)"
              className="ultima-input w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35"
              maxLength={220}
            />
          </div>
        </div>
      )}
    </div>
  );
}
