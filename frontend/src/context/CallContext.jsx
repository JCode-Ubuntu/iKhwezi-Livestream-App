import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// getUserMedia rejects with a DOMException whose `name` is stable across
// browsers, but whose `message` text is not (e.g. Firefox never says the
// literal string "Permission denied") — key off `name` instead.
function friendlyMediaError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera/mic permission denied';
    case 'NotFoundError':
      return 'No camera or microphone found';
    case 'NotReadableError':
      return 'Camera/mic is already in use by another app';
    default:
      return err?.message || 'Could not access camera/mic';
  }
}

// Call phases: idle -> ringing-out (I'm calling) | ringing-in (incoming) -> active -> idle
export function CallProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [phase, setPhase] = useState('idle');
  const [callType, setCallType] = useState('audio'); // 'audio' | 'video'
  const [peer, setPeer] = useState(null); // { id, username, displayName, avatar }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const peerRef = useRef(null);
  // Mirrors of `phase`/`callType` for the call-signal handler below. The
  // handler previously read `phase`/`callType` directly from closure and
  // listed them as effect deps, so socket.off()+socket.on() ran on every
  // single phase transition (idle -> ringing -> connecting -> active -> idle
  // is 3-4 churns per call). Refs let the handler see current values without
  // tearing down/recreating the listener on every state change.
  const phaseRef = useRef(phase);
  const callTypeRef = useRef(callType);
  phaseRef.current = phase;
  callTypeRef.current = callType;

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    pendingCandidatesRef.current = [];
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setPeer(null);
    setPhase('idle');
    setMuted(false);
    setCameraOff(false);
  }, []);

  const signal = useCallback((toUserId, type, payload) => {
    socket?.emit('call-signal', {
      toUserId,
      type,
      payload,
      from: { id: user?.id, username: user?.username, displayName: user?.displayName, avatar: user?.avatar },
    });
  }, [socket, user]);

  const createPeerConnection = useCallback((targetUserId, type) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (e) => {
      if (e.candidate) signal(targetUserId, 'ice-candidate', e.candidate);
    };
    pc.ontrack = (e) => {
      setRemoteStream((prev) => {
        const stream = prev instanceof MediaStream ? prev : new MediaStream();
        stream.addTrack(e.track);
        return stream;
      });
    };
    pc.onconnectionstatechange = () => {
      // 'disconnected' can be a transient network blip that recovers on its own —
      // only 'failed' is terminal. Previously this only set an error message
      // without ever calling cleanup(), so a dropped call left the overlay stuck
      // showing a dead connection forever with no way out but a manual hangup.
      if (pc.connectionState === 'failed') {
        setError('Connection lost');
        cleanup();
      }
    };
    pcRef.current = pc;
    return pc;
  }, [signal, cleanup]);

  const getLocalMedia = useCallback(async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 720 } } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const startCall = useCallback(async (targetUser, type = 'audio') => {
    try {
      setError(null);
      setCallType(type);
      setPeer(targetUser);
      peerRef.current = targetUser;
      setPhase('ringing-out');
      signal(targetUser.id, 'invite', { callType: type });
    } catch (err) {
      setError(err.message);
      cleanup();
    }
  }, [signal, cleanup]);

  const acceptCall = useCallback(async () => {
    if (!peerRef.current) return;
    try {
      setPhase('connecting');
      const stream = await getLocalMedia(callType);
      const pc = createPeerConnection(peerRef.current.id, callType);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      signal(peerRef.current.id, 'accept', {});
    } catch (err) {
      setError(friendlyMediaError(err));
      signal(peerRef.current?.id, 'reject', { reason: 'media-error' });
      cleanup();
    }
  }, [callType, createPeerConnection, getLocalMedia, signal, cleanup]);

  const rejectCall = useCallback(() => {
    if (peerRef.current) signal(peerRef.current.id, 'reject', { reason: 'declined' });
    cleanup();
  }, [signal, cleanup]);

  const endCall = useCallback(() => {
    if (peerRef.current) signal(peerRef.current.id, 'end', {});
    cleanup();
  }, [signal, cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !muted;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !cameraOff;
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  }, [cameraOff]);

  useEffect(() => {
    if (!socket) return undefined;

    const handler = async ({ type, payload, from }) => {
      if (type === 'invite') {
        if (phaseRef.current !== 'idle') {
          socket.emit('call-signal', { toUserId: from.id, type: 'reject', payload: { reason: 'busy' }, from: { id: user?.id } });
          return;
        }
        peerRef.current = from;
        setPeer(from);
        setCallType(payload.callType || 'audio');
        setPhase('ringing-in');
        return;
      }

      if (type === 'accept') {
        // Caller side: callee accepted, now create offer.
        try {
          const stream = await getLocalMedia(callTypeRef.current);
          const pc = createPeerConnection(peerRef.current.id, callTypeRef.current);
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signal(peerRef.current.id, 'offer', offer);
          setPhase('connecting');
        } catch (err) {
          setError(friendlyMediaError(err));
          signal(peerRef.current?.id, 'end', {});
          cleanup();
        }
        return;
      }

      if (type === 'offer') {
        const pc = pcRef.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
          pendingCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signal(peerRef.current.id, 'answer', answer);
          setPhase('active');
        } catch (err) {
          console.error('WebRTC offer handling failed:', err);
          setError('Call connection failed');
          cleanup();
        }
        return;
      }

      if (type === 'answer') {
        const pc = pcRef.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
          pendingCandidatesRef.current = [];
          setPhase('active');
        } catch (err) {
          console.error('WebRTC answer handling failed:', err);
          setError('Call connection failed');
          cleanup();
        }
        return;
      }

      if (type === 'ice-candidate') {
        const pc = pcRef.current;
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
        } else {
          pendingCandidatesRef.current.push(payload);
        }
        return;
      }

      if (type === 'reject') {
        setError(payload?.reason === 'busy' ? `${peerRef.current?.username || 'They'} is on another call` : 'Call declined');
        cleanup();
        return;
      }

      if (type === 'end') {
        cleanup();
        return;
      }
    };

    socket.on('call-signal', handler);
    return () => socket.off('call-signal', handler);
  }, [socket, getLocalMedia, createPeerConnection, signal, cleanup, user]);

  // Clear stale errors after a few seconds
  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // Auto-cancel an unanswered outgoing call after 45s instead of ringing forever.
  useEffect(() => {
    if (phase !== 'ringing-out') return undefined;
    const t = setTimeout(() => {
      setError('No answer');
      endCall();
    }, 45000);
    return () => clearTimeout(t);
  }, [phase, endCall]);

  const value = {
    phase, callType, peer, localStream, remoteStream, muted, cameraOff, error,
    startCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
