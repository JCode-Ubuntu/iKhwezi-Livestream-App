import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Play, Pause } from 'lucide-react';

function Stories({ isOpen, onClose, stories = [] }) {
  const { user } = useAuth();
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    if (isOpen && stories.length > 0) {
      setCurrentStoryIndex(0);
      setProgress(0);
      setIsPlaying(true);
    }
  }, [isOpen, stories]);

  useEffect(() => {
    if (!isPlaying || !isOpen) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Move to next story
          if (currentStoryIndex < stories.length - 1) {
            setCurrentStoryIndex(currentStoryIndex + 1);
            return 0;
          } else {
            onClose();
            return 0;
          }
        }
        return prev + (100 / 15); // 15 seconds per story
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying, isOpen, currentStoryIndex, stories.length, onClose]);

  const currentStory = stories[currentStoryIndex];

  if (!isOpen || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Progress bars */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-1">
        {stories.map((_, index) => (
          <div
            key={index}
            className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-white transition-all duration-150"
              style={{
                width: index < currentStoryIndex ? '100%' : index === currentStoryIndex ? `${progress}%` : '0%'
              }}
            />
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white"
      >
        <X size={24} />
      </button>

      {/* Story content */}
      <div className="h-full flex items-center justify-center">
        {currentStory.type === 'video' ? (
          <video
            ref={videoRef}
            src={currentStory.url}
            className="max-h-full max-w-full"
            autoPlay
            muted
            onLoadedData={() => {
              if (videoRef.current) {
                videoRef.current.play();
              }
            }}
          />
        ) : (
          <img
            src={currentStory.url}
            alt="Story"
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      {/* Play/Pause button */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white"
      >
        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
      </button>

      {/* Story info */}
      <div className="absolute bottom-16 left-4 right-4 text-white">
        <p className="text-sm opacity-80">{currentStory.caption}</p>
      </div>
    </div>
  );
}

export default Stories;