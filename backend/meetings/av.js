'use strict';

/**
 * Meetings — audio/video provider (LiveKit SFU).
 *
 * Meetings are media-gated end to end: the client must ask the backend for a
 * short-lived join token, and the backend only mints one when the requester is
 * a registered (non-guest) member of the meeting's group AND the meeting is
 * live. The client never sees the LiveKit API secret — it receives a signed
 * JWT scoped to exactly one room (meeting_<id>).
 *
 * When LiveKit is not configured (missing env), a NULL provider is used: the
 * meeting payloads keep reporting `audio:false, video:false` and the token
 * route answers 501. The app degrades to presence-only meetings, exactly as
 * this release behaved before the SFU landed.
 *
 * TURN: LiveKit's embedded TURN server is used (config in livekit/livekit.yaml.dist).
 * No separate coturn container is required; only clients behind restrictive
 * NATs/firewalls relay through it, and LiveKit's TURN auth is coupled to the
 * token minted here.
 */

const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

const TOKEN_TTL = '4h';

/** Room name on the SFU for a meeting — stable, guessability is irrelevant
 *  because entry requires a signed token minted after a membership check. */
const roomNameFor = (meetingId) => `meeting_${meetingId}`;

const CAPABILITIES_OFF = Object.freeze({
  presence: true,
  scheduling: true,
  chat: 'group',
  audio: false,
  video: false,
  screenShare: false,
  moderation: 'host',
});

const CAPABILITIES_ON = Object.freeze({
  presence: true,
  scheduling: true,
  chat: 'group',
  audio: true,
  video: true,
  screenShare: true,
  moderation: 'host',
  sfu: 'livekit',
});

/** Feature explicitly disabled on this server (not an error state). */
function featureDisabled() {
  const err = new Error('FEATURE_DISABLED');
  err.status = 501;
  return err;
}

function buildNullProvider() {
  return {
    enabled: false,
    capabilities: CAPABILITIES_OFF,
    async mintJoinToken() { throw featureDisabled(); },
    async onMeetingEnded() {},
  };
}

function buildLiveKitProvider({ url, publicUrl, apiKey, apiSecret, log = () => {} }) {
  // RoomServiceClient talks REST to the SFU host (create/delete rooms,
  // remove participants). Mints stay local — the JWT is signed here, no
  // network involved, so token issuance has no SFU round-trip.
  const svc = new RoomServiceClient(url, apiKey, apiSecret);

  return {
    enabled: true,
    capabilities: CAPABILITIES_ON,

    /** Signed, single-room, short-lived join credential. */
    async mintJoinToken({ meeting, user }) {
      const at = new AccessToken(apiKey, apiSecret, {
        identity: user.id,
        name: user.displayName || user.username || user.id,
        ttl: TOKEN_TTL,
      });
      at.addGrant({
        roomJoin: true,
        room: roomNameFor(meeting.id),
        canPublish: true,
        canSubscribe: true,
      });
      const token = await at.toJwt();
      return { token, url: publicUrl, room: roomNameFor(meeting.id) };
    },

    /**
     * Force-close the SFU room when a meeting ends so participants can't keep
     * talking in a dead meeting. Best effort: the DB transaction that ends the
     * meeting is the source of truth — a failed deleteRoom must not resurrect
     * it. Rooms are also bounded by LiveKit's empty/departure timeouts.
     */
    async onMeetingEnded(meetingId) {
      try {
        await svc.deleteRoom(roomNameFor(meetingId));
      } catch (err) {
        log(`meetings(av): deleteRoom for ${roomNameFor(meetingId)} failed (best-effort): ${err?.message || err}`);
      }
    },
  };
}

/**
 * Read LiveKit config from the environment and build the provider.
 * All four vars are required; anything less is "not configured".
 */
function buildAvProviderFromEnv(env = process.env) {
  const { LIVEKIT_URL, LIVEKIT_PUBLIC_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = env;
  if (!LIVEKIT_URL || !LIVEKIT_PUBLIC_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return buildNullProvider();
  }
  return buildLiveKitProvider({
    url: LIVEKIT_URL,
    publicUrl: LIVEKIT_PUBLIC_URL,
    apiKey: LIVEKIT_API_KEY,
    apiSecret: LIVEKIT_API_SECRET,
  });
}

module.exports = {
  buildAvProviderFromEnv,
  buildNullProvider,
  buildLiveKitProvider,
  CAPABILITIES_OFF,
  CAPABILITIES_ON,
  roomNameFor,
};
