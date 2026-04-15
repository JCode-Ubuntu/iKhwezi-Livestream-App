import React, { useState } from 'react';
import { X, Save, Trash2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function VideoEditModal({ video, onClose, onUpdated, onDeleted }) {
  const { fetchWithAuth, showToast } = useAuth();
  const [title, setTitle] = useState(video.title || '');
  const [caption, setCaption] = useState(video.caption || '');
  const [description, setDescription] = useState(video.description || '');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/videos/${video.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, caption, description }),
      });
      if (res.ok) {
        const updated = await res.json();
        showToast('Video updated!', 'success');
        onUpdated?.({ ...video, ...updated });
        onClose();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update', 'error');
      }
    } catch {
      showToast('Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/videos/${video.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Video deleted', 'success');
        onDeleted?.(video.id);
        onClose();
      } else {
        showToast('Failed to delete', 'error');
      }
    } catch {
      showToast('Failed to delete', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-[300] flex flex-col justify-end bg-black/75 backdrop-blur" role="dialog" aria-modal="true">
      <div onClick={onClose} className="flex-1" />
      <div className="flex max-h-[85vh] flex-col rounded-t-[1.75rem] border border-white/10 border-b-0 bg-[#0c1022]/96 shadow-glass backdrop-blur-3xl" style={{ animation: 'slide-up 0.3s ease' }}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white/65 transition-transform active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <ArrowLeft size={18} />
          </button>
          <h3 className="flex-1 text-lg font-black text-white">Edit Video</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Preview thumbnail */}
          <div className="overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16/9' }}>
            <video
              src={`/storage/uploads/${video.filename}`}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={100}
                placeholder="Add a title…"
                className="input w-full"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Caption</label>
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={300}
                placeholder="Short caption shown on feed…"
                className="input w-full"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={1000}
                placeholder="Detailed description…"
                rows={3}
                className="input w-full resize-none"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-white/10 bg-[#0a0d18]/95 px-5 py-4 pb-6 space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary w-full"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="btn w-full border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            >
              <Trash2 size={16} />
              Delete Video
            </button>
          ) : (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 space-y-2">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={16} />
                <p className="text-sm font-semibold">Delete this video permanently?</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowDeleteConfirm(false)} className="btn btn-ghost flex-1 text-sm">Cancel</button>
                <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
