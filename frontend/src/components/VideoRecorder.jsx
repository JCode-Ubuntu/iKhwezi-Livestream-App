import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, Play, Square, RefreshCw, ArrowLeft, Send, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FILTER_PRESETS } from '../utils/filterPresets';
import { getApiBase } from '../config/appConfig';

function getExtensionFromMimeType(mimeType = '') {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('ogg')) return 'ogv';
  if (mimeType.includes('webm')) return 'webm';
  return 'mp4';
}

function getUploadFile(videoBlob) {
  if (videoBlob instanceof File) {
    return videoBlob;
  }

  const extension = getExtensionFromMimeType(videoBlob?.type);
  const mimeType = videoBlob?.type || `video/${extension}`;
  return new File([videoBlob], `recording.${extension}`, { type: mimeType });
}

function VideoRecorder({ onClose, onVideoUploaded }) {
  const { fetchWithAuth, showToast } = useAuth();
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [mode, setMode] = useState('select'); // select, record, upload, preview
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [filterId, setFilterId] = useState('none');

  const MAX_DURATION = 60000;
  const timerIntervalRef = useRef(null);
  const activeFilter = FILTER_PRESETS.find((f) => f.id === filterId) || FILTER_PRESETS[0];

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stream, previewUrl]);

  const startCamera = async (facing = facingMode) => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true,
      });
      setStream(userStream);
      if (videoRef.current) videoRef.current.srcObject = userStream;
      return userStream;
    } catch (err) {
      showToast('Camera access denied', 'error');
      return null;
    }
  };

  const flipCamera = async () => {
    if (isRecording) return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    await startCamera(newFacing);
  };

  const startRecording = async () => {
    try {
      const userStream = await startCamera(facingMode);
      if (!userStream) return;

      const mediaRecorder = new MediaRecorder(userStream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setMode('preview');
        if (stream) { stream.getTracks().forEach((track) => track.stop()); setStream(null); }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_DURATION) {
            mediaRecorder.stop();
            setIsRecording(false);
            clearInterval(timerIntervalRef.current);
            return MAX_DURATION;
          }
          return prev + 100;
        });
      }, 100);
    } catch (err) {
      showToast('Camera access denied', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setRecordedBlob(file);
        setPreviewUrl(URL.createObjectURL(file));
        setMode('preview');
      } else {
        showToast('Please select a video file', 'error');
      }
    }
  };

  const handleUploadVideo = async () => {
    if (!recordedBlob) {
      showToast('Please select a video to upload', 'error');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      const uploadFile = getUploadFile(recordedBlob);
      formData.append('video', uploadFile, uploadFile.name);
      formData.append('title', caption || 'Untitled');
      formData.append('description', caption);

      const response = await fetch(`${getApiBase()}/videos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('ikhwezi_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      showToast('Video uploaded successfully!', 'success');
      if (onVideoUploaded) onVideoUploaded();
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const goBack = () => {
    if (mode !== 'select') {
      if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      setRecordedBlob(null);
      setCaption('');
      setFilterId('none');
      setIsRecording(false);
      setMode('select');
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black/90 backdrop-blur-xl"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={goBack}
          className="ik-tap-spring flex h-9 w-9 items-center justify-center rounded-full text-white/75"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-pink-400" />
          <span className="text-sm font-bold text-white">New Video</span>
        </div>
        {mode === 'preview' ? (
          <button
            type="button"
            onClick={handleUploadVideo}
            disabled={uploading}
            className="ultima-btn-supreme flex items-center gap-1.5 rounded-full px-4 py-2 text-xs disabled:opacity-40"
          >
            {uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-void-950 border-t-transparent" />
            ) : (
              <Send size={13} />
            )}
            {uploading ? 'Uploading…' : 'Share'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="ik-tap-spring flex h-9 w-9 items-center justify-center rounded-full text-white/75"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {mode === 'select' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-[26px]"
            style={{ background: 'linear-gradient(135deg, #E1306C, #F5C542)', boxShadow: '0 10px 40px rgba(225,48,108,0.4)' }}
          >
            <Camera size={34} color="white" fill="white" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-black text-white">Create Your Video</h2>
            <p className="mt-1 text-sm text-white/50">Record or upload a video up to 1 minute</p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button
              type="button"
              onClick={() => { setMode('record'); setRecordingTime(0); }}
              className="ultima-btn-supreme flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm"
            >
              <Camera size={18} />
              Record Video
            </button>
            <label className="ultima-glass ik-tap-spring flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold text-white/85">
              <Upload size={18} />
              Upload Video
              <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {mode === 'record' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-[420px] rounded-[24px] bg-black object-cover"
            style={{ filter: activeFilter.css }}
          />
          <div className="flex items-center justify-center gap-3">
            <div
              className="h-3 w-3 rounded-full bg-red-500"
              style={isRecording ? { animation: 'pulse 1.4s cubic-bezier(0.4,0,0.6,1) infinite' } : undefined}
            />
            <span className="text-sm text-white/55">
              {Math.floor(recordingTime / 1000)}s / {Math.floor(MAX_DURATION / 1000)}s
            </span>
          </div>
          <div className="flex justify-center gap-3">
            {!isRecording ? (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  className="ultima-btn-supreme flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm"
                >
                  <Play size={17} />
                  Start
                </button>
                <button
                  type="button"
                  onClick={flipCamera}
                  className="ultima-glass ik-tap-spring flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold text-white/85"
                >
                  <RefreshCw size={17} />
                  Flip
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-2xl bg-red-600 px-6 py-3.5 text-sm font-bold text-white"
              >
                <Square size={17} />
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode('select')}
              className="ultima-glass ik-tap-spring flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold text-white/70"
            >
              <X size={17} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'preview' && recordedBlob && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="relative flex items-center justify-center bg-black">
            <video
              src={previewUrl}
              controls
              className="max-h-[320px] w-full object-contain"
              style={{ filter: activeFilter.css }}
            />
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Filter presets */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Filters</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {FILTER_PRESETS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterId(f.id)}
                    className="ik-tap-spring flex shrink-0 flex-col items-center gap-1.5"
                  >
                    <span
                      className="h-12 w-12 rounded-2xl border-2"
                      style={{
                        filter: f.css,
                        background: 'linear-gradient(135deg,#E1306C,#F5C542)',
                        borderColor: filterId === f.id ? '#E1306C' : 'transparent',
                        boxShadow: filterId === f.id ? '0 0 0 1px rgba(225,48,108,0.5), 0 0 16px rgba(225,48,108,0.35)' : 'none',
                      }}
                    />
                    <span className={`text-[10px] font-medium ${filterId === f.id ? 'text-pink-300' : 'text-white/50'}`}>
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <textarea
              placeholder="Add a caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={300}
              className="ultima-input min-h-[90px] w-full resize-none rounded-2xl px-4 py-3.5 text-[15px] text-white outline-none placeholder:text-white/30"
            />
            <p className="text-right text-xs text-white/35">{caption.length}/300</p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleUploadVideo}
                disabled={uploading}
                className="ultima-btn-supreme flex-1 rounded-2xl px-6 py-4 text-sm disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Share'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setRecordedBlob(null);
                  setPreviewUrl(null);
                  setCaption('');
                  setFilterId('none');
                  setMode('select');
                }}
                disabled={uploading}
                className="ultima-glass ik-tap-spring flex-1 rounded-2xl px-6 py-4 text-sm font-semibold text-white/70 disabled:opacity-50"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default VideoRecorder;
