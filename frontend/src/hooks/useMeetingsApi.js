import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { buildMeetingsApi } from '../services/meetings';

/** Memoized meetings client — stable reference for effect dependencies. */
export function useMeetingsApi() {
  const { fetchWithAuth } = useAuth();
  return useMemo(() => buildMeetingsApi(fetchWithAuth), [fetchWithAuth]);
}

export default useMeetingsApi;
