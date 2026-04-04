import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, Play, Square, Trash2, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function VideoRecorder({ onClose, onVideoUploaded }) {
  const { fetchWithAuth, showToast } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  
  const [mode, setMode] = useState('select'); // select, record, upload, preview
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stream, setStream] = useState(null);
  
  const MAX_DURATION = 60000; // 1 minute in ms
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startRecording = async () => {
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });
      
      setStream(userStream);
      videoRef.current.srcObject = userStream;
      
      const mediaRecorder = new MediaRecorder(userStream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setMode('preview');
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
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
        setRecordedBlob(file);
        setMode('preview');
      } else {
        showToast('Please select a video file', 'error');
      }
    }
  };

  const handleUploadVideo = async () => {
    if (!recordedBlob || !title.trim()) {
      showToast('Add a title before uploading', 'error');
      return;
    }
    
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('video', recordedBlob, 'video.webm');
      formData.append('title', title);
      formData.append('description', description);
      
      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ikhwezi_token')}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }
      
      showToast('Video uploaded successfully!', 'success');
      if (onVideoUploaded) onVideoUploaded();
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%',
          width: '90vw',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <button
          onClick={onClose}
          className="close-btn"
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
            background: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#6366f1'
          }}
        >
          <X size={20} />
        </button>

        {mode === 'select' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6F4FFF, #10B981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: '0 10px 40px rgba(111, 79, 255, 0.4)',
              }}
            >
              <Camera size={36} color="white" fill="white" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Create Your Video
            </h2>
            <p style={{ color: '#A0A0A0', marginBottom: 28 }}>
              Record or upload a video up to 1 minute
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => {
                  setMode('record');
                  setRecordingTime(0);
                }}
                className="btn btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Camera size={18} />
                Record Video
              </button>
              <label
                className="btn btn-outline"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer'
                }}
              >
                <Upload size={18} />
                Upload Video
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        )}

        {mode === 'record' && (
          <div style={{ textAlign: 'center' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                maxHeight: 400,
                borderRadius: 12,
                background: '#000',
                marginBottom: 20,
                objectFit: 'cover'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#EF4444',
                ...(isRecording && {
                  animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                })
              }} />
              <span style={{ fontSize: 14, color: '#A0A0A0' }}>
                {Math.floor(recordingTime / 1000)}s / {Math.floor(MAX_DURATION / 1000)}s
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Play size={18} />
                  Start Recording
                </button>
              ) : (
                <>
                  <button
                    onClick={stopRecording}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Square size={18} />
                    Stop
                  </button>
                </>
              )}
              <button
                onClick={() => setMode('select')}
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <X size={18} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {mode === 'preview' && recordedBlob && (
          <div style={{ textAlign: 'center' }}>
            <video
              src={URL.createObjectURL(recordedBlob)}
              controls
              style={{
                width: '100%',
                maxHeight: 400,
                borderRadius: 12,
                background: '#000',
                marginBottom: 20,
                objectFit: 'cover'
              }}
            />
            <input
              type="text"
              placeholder="Video title (required)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: 12,
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0, 0, 0, 0.3)',
                color: 'white',
                fontSize: 14,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.background = 'rgba(0, 0, 0, 0.3)';
              }}
            />
            <textarea
              placeholder="Add a description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: 20,
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0, 0, 0, 0.3)',
                color: 'white',
                fontSize: 14,
                minHeight: 80,
                fontFamily: 'inherit',
                resize: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.background = 'rgba(0, 0, 0, 0.3)';
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={handleUploadVideo}
                disabled={uploading || !title.trim()}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: uploading || !title.trim() ? 0.5 : 1,
                  cursor: uploading || !title.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                <Send size={18} />
                {uploading ? 'Uploading...' : 'Upload Video'}
              </button>
              <button
                onClick={() => {
                  setRecordedBlob(null);
                  setTitle('');
                  setDescription('');
                  setMode('select');
                }}
                disabled={uploading}
                className="btn btn-outline"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: uploading ? 0.5 : 1,
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              >
                <Trash2 size={18} />
                Discard
              </button>
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
    </div>
  );
}

export default VideoRecorder;
