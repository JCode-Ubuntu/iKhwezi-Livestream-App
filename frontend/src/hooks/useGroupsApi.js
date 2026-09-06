import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { buildGroupsApi } from '../services/groups';

/**
 * Stable, memoized Groups REST client bound to the current auth token.
 *
 * `buildGroupsApi(fetchWithAuth)` returns a fresh object every call. Using it
 * directly in a component body made every `useCallback` that depended on it
 * change identity on every render, which re-triggered `useEffect(load)` and
 * produced an infinite request loop against /api/groups. Memoizing on
 * `fetchWithAuth` (itself stable per token) fixes that class of bug for every
 * consumer at once.
 */
export function useGroupsApi() {
  const { fetchWithAuth } = useAuth();
  return useMemo(() => buildGroupsApi(fetchWithAuth), [fetchWithAuth]);
}

export default useGroupsApi;
