import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from 'lucide-react';
import { useCall } from '../context/CallContext';

function initials(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function PeerAvatar({ peer, size = 96 }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-black text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: peer?.avatar ? undefined : 'linear-gradient(135deg,#E1306C,#F5C542)',
        boxShadow: '0 0 60px rgba(225,48,108,0.35)',
      }}
    >
      {peer?.avatar ? (
        <img src={peer.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(peer?.displayName || peer?.username)
      )}
    </div>
  );
}

function CallOverlay() {
  const {
    phase, callType, peer, localStream, remoteStream, muted, cameraOff, error,
    acceptCall, rejectCall, endCall, toggleMute, toggleCamera,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (callType === 'video' && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null;
    if (callType === 'audio' && remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream, callType]);

  if (phase === 'idle' && !error) return null;

  const isVideo = callType === 'video';
  const label = {
    'ringing-out': 'Calling…',
    'ringing-in': isVideo ? 'Incoming video call' : 'Incoming call',
    connecting: 'Connecting…',
    active: isVideo ? 'Video call' : 'Voice call',
  }[phase] || '';

  return (
    <div className="fixed inset-0 z-[500] flex flex-col bg-[#050505]">
      {isVideo && phase === 'active' && (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      )}
      <audio ref={remoteAudioRef} autoPlay />

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/85" />

      {/* Top info */}
      <div
        className="relative z-10 flex flex-col items-center gap-1 px-6 pt-10 text-center"
        style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}
      >
        <p className="ultima-eyebrow">{label}</p>
        <h2 className="font-display text-2xl font-black text-white">
          {peer?.displayName || peer?.username || 'Unknown'}
        </h2>
        {peer?.username && <p className="text-sm text-white/45">@{peer.username}</p>}
        {error && (
          <p className="mt-2 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
            {error}
          </p>
        )}
      </div>

      {/* Center avatar (shown when no remote video feed active) */}
      {!(isVideo && phase === 'active') && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6">
          <div className={phase === 'ringing-in' || phase === 'ringing-out' ? 'animate-pulse' : ''}>
            <PeerAvatar peer={peer} size={128} />
          </div>
        </div>
      )}

      {/* Local video PiP */}
      {isVideo && localStream && phase !== 'ringing-in' && (
        <div className="absolute right-4 top-24 z-20 h-36 w-24 overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        </div>
      )}

      {/* Controls */}
      <div
        className="relative z-10 flex items-center justify-center gap-5 px-6 pb-12"
        style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}
      >
        {phase === 'ringing-in' ? (
          <>
            <button
              type="button"
              onClick={rejectCall}
              aria-label="Decline"
              className="ik-btn ik-fab ik-btn-bouncy"
              style={{ background: 'linear-gradient(135deg,#EF4444,#B91C1C)', boxShadow: '0 14px 36px rgba(239,68,68,0.45)' }}
            >
              <PhoneOff size={26} />
            </button>
            <button
              type="button"
              onClick={acceptCall}
              aria-label="Accept"
              className="ik-btn ik-fab ik-btn-bouncy animate-pulse"
            >
              <Phone size={26} />
            </button>
          </>
        ) : (
          <>
            {phase === 'active' && (
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className={`ik-btn ik-btn-secondary ik-btn-pill flex h-14 w-14 items-center justify-center !p-0 ${muted ? 'bg-white/20' : ''}`}
              >
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            {phase === 'active' && isVideo && (
              <button
                type="button"
                onClick={toggleCamera}
                aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
                className={`ik-btn ik-btn-secondary ik-btn-pill flex h-14 w-14 items-center justify-center !p-0 ${cameraOff ? 'bg-white/20' : ''}`}
              >
                {cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}
            <button
              type="button"
              onClick={endCall}
              aria-label="End call"
              className="ik-btn ik-fab ik-btn-bouncy"
              style={{ background: 'linear-gradient(135deg,#EF4444,#B91C1C)', boxShadow: '0 14px 36px rgba(239,68,68,0.45)' }}
            >
              <PhoneOff size={26} />
            </button>
          </>
        )}
      </div>

      {error && phase === 'idle' && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default CallOverlay;
