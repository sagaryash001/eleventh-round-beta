// ─────────────────────────────────────────────────────────────────────────────
// API base URL helper
//
// - In development: VITE_API_BASE_URL is unset, so calls go to '/api/...'
//   and Vite's dev proxy forwards to http://localhost:3001.
// - In production (Vercel): VITE_API_BASE_URL is set to the Render URL
//   (e.g. https://er-api.onrender.com), so calls go cross-origin to the
//   deployed Express backend.
//
// Set VITE_API_BASE_URL with NO trailing slash and NO '/api' suffix.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/**
 * Build an absolute API URL.
 * Pass a path that starts with '/api/...'
 */
export function apiUrl(path: string): string {
  return `${BASE}${path}`
}

/**
 * Thin fetch wrapper — same signature as `fetch`, but rewrites '/api/...'
 * paths to the configured base URL.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init)
}
