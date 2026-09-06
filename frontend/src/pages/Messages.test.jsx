import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const me = { id: 'me-1', username: 'me', displayName: 'Me' };
const other = { id: 'u-2', username: 'zanele', displayName: 'Zanele' };
const group = { id: 'g-1', name: 'Inner Circle', avatar: null, createdAt: new Date().toISOString() };

const groupsApi = {
  listThreads: vi.fn(async () => [{ group, members: [], unread: 2, lastMessage: { content: 'yo', senderId: other.id, createdAt: new Date().toISOString(), sender: other } }]),
};
vi.mock('../hooks/useGroupsApi', () => ({ useGroupsApi: () => groupsApi }));

const fetchWithAuth = vi.fn(async (path) => {
  if (path === '/messages/conversations') {
    return { ok: true, json: async () => [{ user: other, lastMessage: { content: 'hi', createdAt: new Date().toISOString() }, unread: 1 }] };
  }
  return { ok: true, json: async () => [] };
});
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ fetchWithAuth, user: me, isGuest: false, showToast: vi.fn() }),
}));
vi.mock('../context/SocketContext', () => ({
  useSocket: () => ({ socket: null, joinUserRoom: vi.fn(), groupJoin: vi.fn(), groupLeave: vi.fn(), groupTyping: vi.fn(), groupRead: vi.fn() }),
}));
const openCreateSheet = vi.fn();
vi.mock('../context/CreateFlowContext', () => ({
  useCreateFlow: () => ({ openCreateSheet, openCreate: vi.fn() }),
}));
vi.mock('../ultima/UltimaField', () => ({ default: () => null }));
vi.mock('./GroupChat', () => ({ default: ({ groupId, initialMeetingId }) => <div data-testid="group-chat">chat:{groupId}:{initialMeetingId || '-'}</div> }));
vi.mock('./GroupInfo', () => ({ default: () => <div data-testid="group-info" /> }));
vi.mock('../components/messages/DmThread', () => ({ default: ({ otherUser }) => <div data-testid="dm-thread">dm:{otherUser.id}</div> }));

import Messages from './Messages';

function renderAt(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/messages', state }]}>
      <Routes><Route path="/messages" element={<Messages />} /></Routes>
    </MemoryRouter>,
  );
}

describe('Messages — information architecture + CREATE hand-offs', () => {
  beforeEach(() => { openCreateSheet.mockReset(); });

  it('lists Direct and Group threads with unread counts, and has no local "new/create" menu', async () => {
    renderAt(undefined);
    await waitFor(() => expect(screen.getByText('Inner Circle')).toBeInTheDocument());
    expect(screen.getByText('Zanele')).toBeInTheDocument();
    expect(screen.queryByText(/create group/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^new$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /new message or group/i })).toBeNull();

    // Filter chips.
    fireEvent.click(screen.getByRole('button', { name: /^groups$/i }));
    expect(screen.queryByText('Zanele')).toBeNull();
    expect(screen.getByText('Inner Circle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^direct$/i }));
    expect(screen.getByText('Zanele')).toBeInTheDocument();
    expect(screen.queryByText('Inner Circle')).toBeNull();
  });

  it('opens a group chat directly when handed { openGroupId } from CREATE → Group', async () => {
    renderAt({ openGroupId: 'g-1', openMeetingId: 'm-9' });
    expect(await screen.findByTestId('group-chat')).toHaveTextContent('chat:g-1:m-9');
  });

  it('opens a DM thread when handed { openUser } from CREATE → Message', async () => {
    renderAt({ openUser: other });
    expect(await screen.findByTestId('dm-thread')).toHaveTextContent('dm:u-2');
  });

  it('applies a hand-off that arrives while already on /messages (same-route navigate)', async () => {
    // Simulates CREATE → Meeting / Message being used from the Messages list:
    // App navigates to '/messages' again with fresh state and no remount.
    function Driver() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" onClick={() => navigate('/messages', { state: { openGroupId: 'g-1', openMeetingId: 'm-1' } })}>go-meeting</button>
          <button type="button" onClick={() => navigate('/messages', { state: { openUser: other } })}>go-dm</button>
          <Messages />
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={['/messages']}>
        <Routes><Route path="/messages" element={<Driver />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Inner Circle')).toBeInTheDocument());

    fireEvent.click(screen.getByText('go-meeting'));
    expect(await screen.findByTestId('group-chat')).toHaveTextContent('chat:g-1:m-1');

    fireEvent.click(screen.getByText('go-dm'));
    expect(await screen.findByTestId('dm-thread')).toHaveTextContent('dm:u-2');
    expect(screen.queryByTestId('group-chat')).toBeNull();
  });

  it('empty state sends the user to the CREATE hub', async () => {
    groupsApi.listThreads.mockResolvedValueOnce([]);
    fetchWithAuth.mockResolvedValueOnce({ ok: true, json: async () => [] });
    renderAt(undefined);
    const cta = await screen.findByRole('button', { name: /create/i });
    fireEvent.click(cta);
    expect(openCreateSheet).toHaveBeenCalledTimes(1);
  });
});
