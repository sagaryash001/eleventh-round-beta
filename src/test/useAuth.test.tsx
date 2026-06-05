import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthProvider, useAuth } from '../hooks/useAuth'

// Mock the Supabase client so tests never hit the network
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:         vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange:  vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut:            vi.fn().mockResolvedValue({}),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter><AuthProvider>{children}</AuthProvider></MemoryRouter>
}

describe('useAuth', () => {
  it('starts with no user and loading=false after session hydration', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('returns ok:false with an error message on bad credentials', async () => {
    const { supabase } = await import('../lib/supabase')
    ;(supabase!.auth.signInWithPassword as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: null, error: { message: 'Invalid login credentials' } })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})

    const res = await act(async () =>
      result.current.login('bad@example.com', 'wrongpass')
    )
    expect(res.ok).toBe(false)
    expect(res.error).toBeTruthy()
  })

  it('logout clears user and token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {})
    await act(async () => { await result.current.logout() })
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
  })
})
