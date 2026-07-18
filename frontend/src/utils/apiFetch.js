import { getApiBase } from '../config/appConfig';

/** Parse JSON safely — avoids silent failures when nginx returns HTML error pages. */
export async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new Error(
      response.ok
        ? 'Invalid response from server'
        : `Server error (${response.status})${snippet ? `: ${snippet}` : ''}`
    );
  }
}

/** POST JSON to an API path (e.g. `/auth/login`). Uses patched fetch on native when CapacitorHttp is enabled. */
export async function postJson(endpoint, body) {
  const response = await fetch(`${getApiBase()}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse(response);
  return { response, data };
}
