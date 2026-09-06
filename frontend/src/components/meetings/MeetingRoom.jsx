import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer, VideoTrack } from '@livekit/components-react';
import { Track, RoomEvent, Room as LKRoom } from 'livekit-client';
import {
  X, Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp,
  PhoneOff, Users, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMeetingsApi } from '../../hooks/useMeetingsApi';

/**
 * MeetingRoom — full-screen audio/video surface for one live meeting.
 *
 * Entry: the caller (MeetingDetails) mounts it for a LIVE meeting whose
 * capabilities report A/V as available. Everything below is server-gated:
 *   1. we mint a join credential via POST /api/meetings/:id/media-token —
 *      the backend re-checks group membership + live status, so a stale UI
 *      can never smuggle a non-member into media;
 *   2. the LiveKit Room connects to the SFU with that single-room token;
 *   3. tiles render remote camera/screen tracks; all remote audio is mixed
 *      by RoomAudioRenderer. Local mic/camera/share are toggleable.
 *
 * The SFU is the live media state; the DB presence roster stays the record
 * of truth for the meeting list — disconnecting here lets the parent decide
 * whether to also leave presence. When the host ends the meeting, the parent
 * unmounts us (meeting.status !== 'live'), which disconnects the room.
 */

const AVATAR_COLORS = ['#e2498f', '#7c5cff', '#2fb8b3', '#e08521', '#546ee0'];

function Tile({ trackRef }) {
  const p = trackRef.participant;
  const name = p.isLocal ? 'You' : (p.name || p.identity.slice(0, 8));
  const isScreen = trackRef.source === Track.Source.ScreenShare;
  const initials = (p.name || p.identity || '?').charAt(0).toUpperCase();
  const color = AVATAR_COLORS[(p.identity.charCodeAt(0) || 0) % AVATAR_COLORS.length];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
      <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
      {trackRef.publication.muted && !isScreen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <span className="avatar flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold" style={{ background: color }}>
            {initials}
          </span>
        </div>
      )}
      <span className="absolute inset-x-2 bottom-2 max-w-[calc(100%-16px)] truncate rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
        {isScreen ? `${name} · screen` : name}
      </span>
    </div>
  );
}

/** Camera + screen-share tiles; audio flows separately via RoomAudioRenderer. */
function VideoStage() {
  const trackRefs = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: true });
  const cols = trackRefs.length <= 1 ? 'grid-cols-1' : 'grid-cols-2';
  if (!trackRefs.length) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/40">
        <Users size={28} />
        <p className="text-sm">Waiting for video…</p>
      </div>
    );
  }
  return (
    <div className={`grid h-full w-full gap-2 ${cols}`} data-testid="meeting-tiles">
      {trackRefs.map((ref) => (
        <div key={ref.publication.trackSid} className="min-h-0">
          <Tile trackRef={ref} />
        </div>
      ))}
    </div>
  );
}

export default function MeetingRoom({ meeting, onLeave }) {
  const { showToast } = useAuth();
  const api = useMeetingsApi();

  const [phase, setPhase] = useState('join'); // join | connecting | live | error
  const [error, setError] = useState('');
  const [grant, setGrant] = useState(null); // { token, url, room }
  const [count, setCount] = useState(1);
  const [media, setMedia] = useState({ mic: true, cam: true }); // start with mic+cam on, user can toggle
  const leftRef = useRef(false);

  // One Room per meeting; disconnect on unmount (React StrictMode-safe).
  const room = useMemo(() => new LKRoom({
    adaptiveStream: true,
    dynacast: true,
  }), [meeting.id]);

  const leave = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    try { room.disconnect(); } catch { /* best effort */ }
    onLeave?.(grant?.room || null);
  }, [room, onLeave, grant]);

  useEffect(() => () => {
    // Unmount cleanup: the room may outlive this component otherwise and
    // keep mic/cam hardware open. Safe to call repeatedly.
    if (room.state !== 'disconnected') { try { room.disconnect(); } catch { /* noop */ } }
  }, [room]);

  // 1) Mint the join credential (server re-checks membership + live).
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const g = await api.mediaToken(meeting.id);
        if (dead) return;
        setGrant(g);
        setPhase('connecting');
      } catch (err) {
        if (dead) return;
        setError(err.message || 'Could not join this call');
        setPhase('error');
      }
    })();
    return () => { dead = true; };
  }, [api, meeting.id]);

  // 3) Participant count + forced teardown when the SFU closes the room.
  useEffect(() => {
    const recount = () => setCount(1 + room.remoteParticipants.size);
    const onDisconnected = () => { if (!leftRef.current) leave(); };
    room.on(RoomEvent.ParticipantConnected, recount);
    room.on(RoomEvent.ParticipantDisconnected, recount);
    room.on(RoomEvent.Disconnected, onDisconnected);
    recount();
    return () => {
      room.off(RoomEvent.ParticipantConnected, recount);
      room.off(RoomEvent.ParticipantDisconnected, recount);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room, leave]);

  const toggle = async (kind) => {
    try {
      if (kind === 'mic') {
        await room.localParticipant.setMicrophoneEnabled(!media.mic);
        setMedia((m) => ({ ...m, mic: room.localParticipant.isMicrophoneEnabled }));
      } else if (kind === 'cam') {
        await room.localParticipant.setCameraEnabled(!media.cam);
        setMedia((m) => ({ ...m, cam: room.localParticipant.isCameraEnabled }));
      } else if (kind === 'share') {
        if (!media.share) {
          try {
            await room.localParticipant.setScreenShareEnabled(true);
            setMedia((m) => ({ ...m, share: true }));
          } catch {
            showToast('Screen share is not supported on this device', 'error');
          }
        } else {
          await room.localParticipant.setScreenShareEnabled(false);
          setMedia((m) => ({ ...m, share: false }));
        }
      }
    } catch (err) {
      showToast(err?.message || 'Could not switch the device', 'error');
    }
  };

  const title = meeting.title || 'Meeting';

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col bg-[#0b0d12]"
      role="dialog"
      aria-modal
      aria-label={`Meeting call: ${title}`}
      data-testid="meeting-room"
    >
      {/* Top bar */}
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-black/40 px-4 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{title}</p>
          <p className="text-[11px] text-white/50" data-testid="meeting-count">{count} in the call</p>
        </div>
        <button
          type="button"
          onClick={leave}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70"
          aria-label="Leave and close call"
        >
          <X size={16} />
        </button>
      </div>

      {/* Media stage */}
      <div className="min-h-0 flex-1 p-3">
        {phase === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center" data-testid="meeting-error">
            <ShieldAlert size={32} className="text-red-400" />
            <p className="max-w-xs text-sm text-white/70">{error}</p>
            <button type="button" onClick={leave} className="ik-btn ik-btn-secondary ik-btn-pill px-5 py-2 text-sm font-bold">
              Back
            </button>
          </div>
        )}

        {(phase === 'join' || phase === 'connecting') && (
          <div className="flex h-full flex-col items-center justify-center gap-3" data-testid="meeting-connecting">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
            <p className="text-sm text-white/50">{phase === 'join' ? 'Checking access…' : 'Connecting…'}</p>
          </div>
        )}

        {phase !== 'error' && grant && (
          <LiveKitRoom
            room={room}
            token={grant.token}
            serverUrl={grant.url}
            connectOptions={{ autoSubscribe: true }}
            audio={{ autoGainControl: true, echoCancellation: true, noiseSuppression: true }}
            video={{ resolution: { width: 720, height: 1280 } }}
            onConnected={() => {
              setPhase('live');
              setMedia((m) => ({
                ...m,
                mic: room.localParticipant.isMicrophoneEnabled,
                cam: room.localParticipant.isCameraEnabled,
              }));
            }}
            onDisconnected={() => !leftRef.current && leave()}
            onError={(e) => { setError(e?.message || 'Connection error'); setPhase('error'); }}
          >
            <VideoStage />
            <RoomAudioRenderer />
          </LiveKitRoom>
        )}
      </div>

      {/* Controls */}
      {grant && phase !== 'error' && (
        <div
          className="flex shrink-0 items-center justify-center gap-3 border-t border-white/8 bg-black/40 px-4"
          style={{ paddingTop: 12, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => toggle('mic')}
            className={`flex h-11 w-11 items-center justify-center rounded-full border ${media.mic ? 'border-white/15 bg-white/10 text-white' : 'border-red-500/40 bg-red-500/20 text-red-300'}`}
            aria-label={media.mic ? 'Mute microphone' : 'Unmute microphone'}
          >
            {media.mic ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button
            type="button"
            onClick={() => toggle('cam')}
            className={`flex h-11 w-11 items-center justify-center rounded-full border ${media.cam ? 'border-white/15 bg-white/10 text-white' : 'border-red-500/40 bg-red-500/20 text-red-300'}`}
            aria-label={media.cam ? 'Turn camera off' : 'Turn camera on'}
          >
            {media.cam ? <VideoIcon size={18} /> : <VideoOff size={18} />}
          </button>
          <button
            type="button"
            onClick={() => toggle('share')}
            className={`flex h-11 w-11 items-center justify-center rounded-full border ${media.share ? 'border-gold-400/50 bg-gold-500/20 text-gold-200' : 'border-white/15 bg-white/10 text-white'}`}
            aria-label={media.share ? 'Stop screen share' : 'Share screen'}
          >
            <MonitorUp size={18} />
          </button>
          <button
            type="button"
            onClick={leave}
            className="flex h-11 items-center gap-2 rounded-full bg-red-500 px-5 text-sm font-bold text-white hover:bg-red-600"
            aria-label="Leave call"
            data-testid="leave-call"
          >
            <PhoneOff size={17} /> Leave
          </button>
        </div>
      )}
    </div>
  );
}
