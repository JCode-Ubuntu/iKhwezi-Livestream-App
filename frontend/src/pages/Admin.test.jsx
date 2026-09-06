import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Phase 3A — RBAC admin-panel flow (FE side).
 * The admin panel no longer uses a shared ADMIN_KEY: it authorizes with the
 * logged-in account's JWT, and the server checks the DB role per request.
 * These tests pin the FE contract: role-aware gating of tabs/actions, JWT
 * sent on every admin call, and the deny state for non-admin accounts.
 * (Server-side fail-closed behaviour lives in backend/test/rbac.test.js.)
 */

const fetchWithAuth = vi.fn();
let userState = null; // { id, role, isAdmin }

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ fetchWithAuth, user: userState, token: 'jwt-test-token' }),
}));
vi.mock('../ultima/UltimaField', () => ({ default: () => null }));
vi.mock('../ultima/admin.css', () => ({}));
vi.mock('../config/appConfig', () => ({
  getApiBase: () => 'http://localhost:3001/api',
  resolveMediaUrl: (f) => `http://localhost:3001/uploads/${f}`,
}));

import Admin from './Admin';

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes><Route path="/admin" element={<Admin />} /></Routes>
    </MemoryRouter>,
  );
}

// Server-shaped /admin/verify response per caller role.
function verifyResponder(role) {
  return async (endpoint, options = {}) => {
    if (endpoint === '/admin/verify') {
      if (!userState) return { ok: false, status: 401, json: async () => ({ error: 'Authentication required' }) };
      if (role === null) return { ok: false, status: 403, json: async () => ({ error: 'Access denied' }) };
      return { ok: true, status: 200, json: async () => ({ valid: true, role }) };
    }
    return { ok: true, status: 200, json: async () => ([]) };
  };
}

beforeEach(() => {
  fetchWithAuth.mockReset();
  userState = null;
});

describe('Admin panel — RBAC (Phase 3A)', () => {
  it('denies a plain authenticated user (no admin key entry point exists)', async () => {
    userState = { id: 'u-1', role: 'user', isAdmin: false };
    fetchWithAuth.mockImplementation(verifyResponder(null));

    renderAt();

    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalledWith('/admin/verify', expect.anything()));
    expect(await screen.findByText(/does not have admin privileges/i)).toBeInTheDocument();
    // No admin-key input exists anymore — the shared secret is retired here.
    expect(screen.queryByPlaceholderText(/admin key/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /access admin panel/i })).toBeNull();
  });

  it('admits an admin-role account, probes with the session JWT, and renders the full tab set', async () => {
    userState = { id: 'u-2', role: 'admin', isAdmin: true };
    fetchWithAuth.mockImplementation(verifyResponder('admin'));

    renderAt();

    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalledWith('/admin/verify', expect.anything()));
    // Full admin sees all six tabs.
    await waitFor(() => expect(screen.getByRole('tab', { name: /streaming/i })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /videos/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tailored ads/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audit log/i })).toBeInTheDocument();
  });

  it('renders a moderator ONLY the Users tab (ban/unban is their whole scope)', async () => {
    userState = { id: 'u-3', role: 'moderator', isAdmin: false };
    fetchWithAuth.mockImplementation(verifyResponder('moderator'));

    renderAt();

    await waitFor(() => expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: /streaming/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /videos/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /tailored ads/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /analytics/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /audit log/i })).toBeNull();
  });

  it('passes no X-Admin-Key on any admin call (JWT only)', async () => {
    userState = { id: 'u-2', role: 'admin', isAdmin: true };
    fetchWithAuth.mockImplementation(verifyResponder('admin'));

    renderAt();
    await waitFor(() => expect(fetchWithAuth.mock.calls.length).toBeGreaterThan(0));
    for (const call of fetchWithAuth.mock.calls) {
      const [endpoint, options] = call;
      const headers = options?.headers || {};
      const flat = JSON.stringify(headers);
      expect(flat.includes('X-Admin-Key')).toBe(false);
    }
  });

  it('hides the Admin role-grant button from a moderator', async () => {
    userState = { id: 'u-3', role: 'moderator', isAdmin: false };
    // Users tab lists need /admin/users + /admin/users/:id/ban flows; serve
    // one fake user row and let the panel render it.
    fetchWithAuth.mockImplementation(async (endpoint) => {
      if (endpoint === '/admin/verify') return { ok: true, json: async () => ({ valid: true, role: 'moderator' }) };
      if (endpoint === '/admin/users') return { ok: true, json: async () => ([{ id: 'target-1', username: 'thabo', email: 't@x.co', points: { totalPoints: 3 }, isBanned: false, role: 'user' }]) };
      return { ok: true, json: async () => ([]) };
    });

    renderAt();

    expect(await screen.findByText('@thabo')).toBeInTheDocument();
    // Moderators get ban/unban only — no role minting in the UI.
    expect(screen.queryByTitle(/grant broadcast rights/i)).toBeNull();
    expect(screen.queryByTitle(/revoke broadcast rights/i)).toBeNull();
    // Ban remains available: that IS the moderator power.
    expect(screen.getByTitle(/block user/i)).toBeInTheDocument();
  });
});
