import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CreateFlowProvider, useCreateFlow, CREATE_ACTIONS } from './CreateFlowContext';

function Consumer() {
  const { openCreateSheet, openCreate } = useCreateFlow();
  return (
    <>
      <button type="button" onClick={openCreateSheet}>sheet</button>
      <button type="button" onClick={() => openCreate('story')}>story</button>
      <button type="button" onClick={() => openCreate('meeting', { groupId: 'g1' })}>meeting</button>
      <button type="button" onClick={() => openCreate('bogus')}>bogus</button>
    </>
  );
}

describe('CreateFlowContext', () => {
  it('exposes the eight hub actions', () => {
    expect(CREATE_ACTIONS).toEqual(['signal', 'video', 'image', 'story', 'group', 'message', 'live', 'meeting']);
  });

  it('routes openCreateSheet / openCreate to the provider callbacks', () => {
    const openCreateSheet = vi.fn();
    const openCreate = vi.fn();
    render(
      <CreateFlowProvider openCreateSheet={openCreateSheet} openCreate={openCreate}>
        <Consumer />
      </CreateFlowProvider>,
    );
    fireEvent.click(screen.getByText('sheet'));
    expect(openCreateSheet).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('story'));
    expect(openCreate).toHaveBeenCalledWith('story', undefined);
    fireEvent.click(screen.getByText('meeting'));
    expect(openCreate).toHaveBeenCalledWith('meeting', { groupId: 'g1' });
  });

  it('ignores unknown actions instead of opening something random', () => {
    const openCreate = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <CreateFlowProvider openCreateSheet={() => {}} openCreate={openCreate}>
        <Consumer />
      </CreateFlowProvider>,
    );
    fireEvent.click(screen.getByText('bogus'));
    expect(openCreate).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/CreateFlowProvider/);
    spy.mockRestore();
  });
});
