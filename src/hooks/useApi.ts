import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { apiFetch } from '../lib/api'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

// ── Module-level cache (stale-while-revalidate) ──────────────────────────────
// Keyed by `${token}::${path}` so a new login (new token) is a cache miss and
// never serves another account's data. Survives component unmount/remount, so
// switching dashboard zones reuses already-fetched data instead of re-loading.
const cache = new Map<string, unknown>()

/** Drop all cached API responses. Called on logout so the next user never
 *  sees the previous user's cached data. Does NOT touch public caches
 *  (cart, intro flag) which live in localStorage, not here. */
export function clearApiCache() {
  cache.clear()
}

/**
 * Fetches an API endpoint using the current user's auth token.
 *
 * SWR behaviour: if a previous result is cached, it is shown instantly and the
 * request is revalidated in the background. First load (no cache) shows
 * `loading: true` so callers can render a skeleton. A background revalidation
 * failure keeps the cached data rather than surfacing a transient error.
 */
export function useApi<T>(path: string): ApiState<T> {
  const { token } = useAuth()
  const key = token ? `${token}::${path}` : ''

  const [state, setState] = useState<ApiState<T>>(() => {
    const cached = key ? (cache.get(key) as T | undefined) : undefined
    return { data: cached ?? null, loading: cached === undefined, error: null }
  })

  useEffect(() => {
    if (!token) return

    let cancelled = false
    const cached = cache.get(key) as T | undefined
    // Show cached instantly; only block with a spinner on a true cold load.
    setState({ data: cached ?? null, loading: cached === undefined, error: null })

    apiFetch(path, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) return res.json().then(j => { throw new Error(j.error ?? `HTTP ${res.status}`) })
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        cache.set(key, data)
        setState({ data, loading: false, error: null })
      })
      .catch(err => {
        if (cancelled) return
        const stale = cache.get(key) as T | undefined
        // Keep last-known-good data on a revalidation blip; only surface the
        // error when we have nothing to show.
        if (stale !== undefined) setState({ data: stale, loading: false, error: null })
        else setState({ data: null, loading: false, error: err.message })
      })

    return () => { cancelled = true }
  }, [token, path, key])

  return state
}
