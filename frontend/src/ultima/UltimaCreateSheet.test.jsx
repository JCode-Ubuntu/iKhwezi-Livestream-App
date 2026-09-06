import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UltimaCreateSheet from './UltimaCreateSheet';

const ACTIONS = [
  ['signal', 'Signal', 'onSignal'],
  ['video', 'Video', 'onVideo'],
  ['image', 'Photo', 'onImage'],
  ['story', 'Story', 'onStory'],
  ['group', 'Group', 'onGroup'],
  ['message', 'Message', 'onMessage'],
  ['live', 'Go Live', 'onGoLive'],
  ['meeting', 'Meeting', 'onMeeting'],
];

function renderSheet(extra = {}) {
  const handlers = Object.fromEntries(ACTIONS.map(([, , prop]) => [prop, vi.fn()]));
  const onClose = vi.fn();
  render(<UltimaCreateSheet onClose={onClose} {...handlers} {...extra} />);
  return { handlers, onClose };
}

describe('UltimaCreateSheet — the CREATE hub', () => {
  it('renders exactly the eight hub actions in the specified order', () => {
    renderSheet();
    const labels = ACTIONS.map(([id]) => screen.getByTestId(`create-${id}`).querySelector('p').textContent);
    expect(labels).toEqual(ACTIONS.map(([, label]) => label));
  });

  it('each action closes the sheet and fires its handler', () => {
    const { handlers, onClose } = renderSheet();
    ACTIONS.forEach(([id, , prop]) => {
      fireEvent.click(screen.getByTestId(`create-${id}`));
      expect(handlers[prop]).toHaveBeenCalledTimes(1);
    });
    expect(onClose).toHaveBeenCalledTimes(ACTIONS.length);
  });

  it('describes Go Live honestly for operators vs viewers', () => {
    const { unmount } = render(<UltimaCreateSheet onClose={() => {}} canBroadcast />);
    expect(screen.getByTestId('create-live')).toHaveTextContent(/operator broadcast/i);
    unmount();
    render(<UltimaCreateSheet onClose={() => {}} canBroadcast={false} />);
    expect(screen.getByTestId('create-live')).toHaveTextContent(/watch live/i);
  });

  it('closes on backdrop click and on the close button, but not on inner clicks', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('heading', { name: 'Create' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
