import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MeetingDetails from './MeetingDetails';

/**
 * MeetingDetails — capabilities-honest sheet.
 *
 * The server decides what exists: with A/V configured (LiveKit) a live
 * meeting shows "Join call" and opens the (lazy) MeetingRoom; with A/V off
 * the sheet stays presence-only, explains itself, and never links to a call
 * surface. Stale/non-live states hide call entry entirely.
 *
 * MeetingRoom is React.lazy-imported and drags the WebRTC stack, so the test
 * mocks the module and asserts on the mount boundary, not call internals.
 *
 * Mock-shape notes (each one bit us when wrong):
 *  - vi.mock factories are hoisted ABOVE imports; anything they touch must
 *    come from vi.hoisted, or it "does not exist yet" at factory-run time.
 *  - useMeetingsApi must return the SAME object every render (production
 *    memoizes it). A fresh object per render changes `load`'s useCallback dep
 *    identity every render, re-firing the loading effect forever.
 *  - api.get must return a FRESH object per call (like a real JSON fetch), or
 *    React's Object.is state bail-out swallows server pushes.
 */

const { MEETING_BY_ID, SOCKETS, STABLE_API } = vi.hoisted(() => {
  const MEETING_BY_ID = {};
  const api = {
    async get(id) { return { ...MEETING_BY_ID[id] }; },
    async join(id) { return { ...MEETING_BY_ID[id] }; },
    async leave(id) { return { ...MEETING_BY_ID[id] }; },
    async start(id) { return { ...MEETING_BY_ID[id] }; },
    async end(id) { return { ...MEETING_BY_ID[id] }; },
    async cancel(id) { return { ...MEETING_BY_ID[id] }; },
    async mediaToken(id) { return { token: 't', url: 'wss://test/livekit', room: `meeting_${id}` }; },
  };
  return { MEETING_BY_ID, SOCKETS: { current: null }, STABLE_API: api };
});

vi.mock('./MeetingRoom', () => ({
  default: ({ meeting, onLeave }) => (
    meeting ? (
      <div data-testid="meeting-room-stub" data-meeting={meeting.id}>
        <button type="button" onClick={onLeave}>stub-leave</button>
      </div>
    ) : null
  ),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ showToast: () => {} }),
}));

vi.mock('../../context/SocketContext', () => ({
  useSocket: () => ({ socket: SOCKETS.current || null }),
}));

vi.mock('../../hooks/useMeetingsApi', () => ({
  useMeetingsApi: () => STABLE_API,
}));

/** Minimal socket stub: handlers are invocable from tests, like the server push. */
function makeSocket() {
  const handlers = new Map();
  return {
    on: (event, fn) => { handlers.set(event, (handlers.get(event) || new Set()).add(fn)); },
    off: (event, fn) => { handlers.get(event)?.delete(fn); },
    emit: (event, payload) => { handlers.get(event)?.forEach((fn) => fn(payload)); },
  };
}

const MEETING = {
  id: 'm-1',
  groupId: 'g-1',
  title: 'Sunday sync',
  status: 'live',
  scheduledAt: null,
  description: 'Weekly check-in',
  host: { id: 'u-1', username: 'jcode', displayName: 'JCode', avatar: null },
  group: { id: 'g-1', name: 'Inner Circle', avatar: null },
  participantCount: 1,
  participants: [{ userId: 'u-1', role: 'host', user: { id: 'u-1', username: 'jcode', displayName: 'JCode', avatar: null } }],
  viewer: { isHost: false, canManage: false, isJoined: false },
  capabilities: { presence: true, scheduling: true, audio: true, video: true, screenShare: true, moderation: 'host' },
};
const CAPS_OFF = { presence: true, scheduling: true, audio: false, video: false, screenShare: false, moderation: 'host' };

function setMeeting(overrides = {}) {
  MEETING_BY_ID['m-1'] = { ...MEETING, ...overrides };
}

function renderSheet(props = {}) {
  return render(
    <MeetingDetails
      meetingId="m-1"
      onClose={vi.fn()}
      onChanged={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  setMeeting();
  SOCKETS.current = makeSocket();
});

describe('MeetingDetails — A/V is server-driven', () => {
  it('live meeting + A/V available → Join call opens the (stubbed) MeetingRoom after marking presence', async () => {
    renderSheet();
    expect(await screen.findByText('Live now')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('join-call'));
    // viewer.isJoined is false → the click also asks the API to mark presence.
    expect(await screen.findByTestId('meeting-room-stub')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-room-stub')).toHaveAttribute('data-meeting', 'm-1');
  });

  it('A/V unavailable → presence-only: honest notice, no call surface, presence Join still offered', async () => {
    setMeeting({ capabilities: CAPS_OFF });
    renderSheet();
    expect(await screen.findByText('Live now')).toBeInTheDocument();

    expect(screen.queryByTestId('join-call')).toBeNull();
    expect(screen.queryByTestId('meeting-room-stub')).toBeNull();
    expect(screen.getByText(/not enabled on this server/i)).toBeInTheDocument();
    expect(screen.getByText('Join')).toBeInTheDocument();
  });

  it('scheduled meeting hides all call/join entry; host sees Start now', async () => {
    setMeeting({ status: 'scheduled', viewer: { isHost: true, canManage: true, isJoined: false } });
    renderSheet();
    await waitFor(() => expect(screen.getByText('Scheduled')).toBeInTheDocument());
    expect(screen.queryByTestId('join-call')).toBeNull();
    expect(screen.queryByText('Join')).toBeNull();
    expect(screen.getByText('Start now')).toBeInTheDocument();
  });

  it('host ending the meeting closes an open call surface (socket-driven refetch)', async () => {
    setMeeting({ viewer: { isHost: true, canManage: true, isJoined: true } });
    renderSheet();
    fireEvent.click(await screen.findByTestId('join-call'));
    expect(await screen.findByTestId('meeting-room-stub')).toBeInTheDocument();

    // Production flow: backend emits meeting-updated → sheet refetches →
    // reads status=ended → the inCall effect drops the call surface.
    setMeeting({ status: 'ended' });
    SOCKETS.current.emit('meeting-updated', { meetingId: 'm-1', groupId: 'g-1' });

    await waitFor(() => expect(screen.queryByTestId('meeting-room-stub')).toBeNull());
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });
});
