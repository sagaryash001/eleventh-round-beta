// ─────────────────────────────────────────────────────────────────────────────
// Authenticated API client
//
// Wraps apiFetch (src/lib/api.ts) and attaches the current Supabase session
// access token as a Bearer header — that's what the Express `requireAuth`
// middleware expects. Parses JSON and throws a friendly Error on non-2xx.
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from '../api'
import { supabase } from '../supabase'

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path, { headers: { ...(await authHeader()) } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json as T
}

async function send<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json as T
}

export const apiPost  = <T = any>(path: string, body?: unknown) => send<T>('POST', path, body)
export const apiPatch = <T = any>(path: string, body?: unknown) => send<T>('PATCH', path, body)
export const apiPut   = <T = any>(path: string, body?: unknown) => send<T>('PUT', path, body)
