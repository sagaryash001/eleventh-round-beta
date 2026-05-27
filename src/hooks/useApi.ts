import { useState, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { apiFetch } from '../lib/api'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetches an API endpoint using the current user's auth token.
 * Returns null data for demo users (token === 'demo-token') so dashboards
 * fall back to their built-in hardcoded values transparently.
 */
export function useApi<T>(path: string): ApiState<T> {
  const { token } = useAuth()
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: false, error: null })
  const pathRef = useRef(path)
  pathRef.current = path

  useEffect(() => {
    if (!token || token === 'demo-token') return

    let cancelled = false
    setState({ data: null, loading: true, error: null })

    apiFetch(pathRef.current, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) return res.json().then(j => { throw new Error(j.error ?? `HTTP ${res.status}`) })
        return res.json()
      })
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }) })
      .catch(err => { if (!cancelled) setState({ data: null, loading: false, error: err.message }) })

    return () => { cancelled = true }
  }, [token, path])

  return state
}
