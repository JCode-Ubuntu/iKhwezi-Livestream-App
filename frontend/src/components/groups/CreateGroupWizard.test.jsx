import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = {
  createGroup: vi.fn(),
};
vi.mock('../../hooks/useGroupsApi', () => ({ useGroupsApi: () => api }));

const searchResults = [
  { id: '11111111-1111-4111-8111-111111111111', username: 'thabo', displayName: 'Thabo' },
  { id: '22222222-2222-4222-8222-222222222222', username: 'zanele', displayName: 'Zanele' },
];
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    fetchWithAuth: vi.fn(async () => ({ ok: true, json: async () => searchResults })),
    showToast: vi.fn(),
  }),
}));

import CreateGroupWizard from './CreateGroupWizard';

describe('CreateGroupWizard — CREATE → Group', () => {
  beforeEach(() => { api.createGroup.mockReset(); });

  it('walks members → details → review and posts the right payload', async () => {
    const onCreated = vi.fn();
    render(<CreateGroupWizard onCreated={onCreated} onClose={() => {}} />);

    // Step 1: pick a member via search.
    fireEvent.change(screen.getByPlaceholderText(/search people to add/i), { target: { value: 'th' } });
    await waitFor(() => expect(screen.getByText('Thabo')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Thabo'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: details. Next is disabled until the name is valid.
    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/inner circle/i), { target: { value: 'ab' } });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/inner circle/i), { target: { value: 'Inner Circle' } });
    fireEvent.change(screen.getByPlaceholderText(/what's this group about/i), { target: { value: 'friends' } });
    expect(next).toBeEnabled();
    fireEvent.click(next);

    // Step 3: review + create.
    expect(screen.getByText('Inner Circle')).toBeInTheDocument();
    expect(screen.getByText(/1 member/)).toBeInTheDocument();
    api.createGroup.mockResolvedValue({ id: 'g-1', name: 'Inner Circle' });
    fireEvent.click(screen.getByRole('button', { name: /create group/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'g-1', name: 'Inner Circle' }));
    expect(api.createGroup).toHaveBeenCalledWith({
      name: 'Inner Circle',
      description: 'friends',
      avatarFile: null,
      isPrivate: true,
      memberIds: [searchResults[0].id],
    });
  });

  it('shows the server error and keeps the user on the review step', async () => {
    render(<CreateGroupWizard onCreated={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByPlaceholderText(/inner circle/i), { target: { value: 'Dupe' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    api.createGroup.mockRejectedValue(new Error('You already have a group with that name'));
    fireEvent.click(screen.getByRole('button', { name: /create group/i }));
    await waitFor(() => expect(screen.getByText(/already have a group/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /create group/i })).toBeEnabled();
  });
});
