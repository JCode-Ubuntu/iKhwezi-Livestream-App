import React, { useRef, useEffect, useState, useCallback } from 'react';

function VideoPlayer({ src, isActive, onVideoEnd }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleEnded = () => {
      video.currentTime = 0;
      video.play().catch(() => {});
      if (onVideoEnd) onVideoEnd();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onVideoEnd]);

  const togglePlay = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const [magnify, setMagnify] = useState(false);
  const longPressRef = useRef(null);
  const heldLongRef = useRef(false);
  const suppressClickRef = useRef(false);

  const onPointerDown = () => {
    heldLongRef.current = false;
    longPressRef.current = window.setTimeout(() => {
      heldLongRef.current = true;
      setMagnify(true);
      if (navigator.vibrate) try { navigator.vibrate(10); } catch { /* ignore */ }
    }, 480);
  };

  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (heldLongRef.current) {
      suppressClickRef.current = true;
      heldLongRef.current = false;
    }
    setMagnify(false);
  };

  return (
    <div 
      onClick={togglePlay}
      onPointerDown={onPointerDown}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
      style={{
        position: 'absolute',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        loop
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: magnify ? 'scale(1.12)' : 'scale(1)',
          transformOrigin: 'center center',
          transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
      
      {!isPlaying && (
        <div style={{
          position: 'absolute',
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(111, 79, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 40px rgba(111, 79, 255, 0.6)',
        }}>
          <div style={{
            width: 0,
            height: 0,
            borderLeft: '24px solid white',
            borderTop: '14px solid transparent',
            borderBottom: '14px solid transparent',
            marginLeft: 6,
          }} />
        </div>
      )}
      
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: 'rgba(255, 255, 255, 0.2)',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #6F4FFF, #FFB800)',
          transition: 'width 0.1s linear',
        }} />
      </div>
    </div>
  );
}

export default React.memo(VideoPlayer);
