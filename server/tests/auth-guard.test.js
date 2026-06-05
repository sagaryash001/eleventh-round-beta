import { describe, it, expect } from 'vitest'
import supertest from 'supertest'
import app from '../app.js'

const api = supertest(app)

// Protected routes return 401 when no Authorization header is sent.
// This test verifies the auth middleware is correctly applied — no mocking
// needed because `requireAuth` checks for the Bearer header before touching
// Supabase, and returns 401 immediately when it's absent.

const PROTECTED_ROUTES = [
  { method: 'get',  path: '/api/auth/me'           },
  { method: 'get',  path: '/api/fighter/overview'  },
  { method: 'get',  path: '/api/contracts'         },
  { method: 'get',  path: '/api/notifications'     },
  { method: 'get',  path: '/api/conversations'     },
]

describe('requireAuth middleware — no token', () => {
  for (const { method, path } of PROTECTED_ROUTES) {
    it(`${method.toUpperCase()} ${path} → 401 without Authorization header`, async () => {
      const res = await api[method](path)
      expect(res.status).toBe(401)
      expect(res.body.error).toMatch(/unauthorized/i)
    })
  }
})

describe('requireAuth middleware — malformed token', () => {
  it('returns 401 when Authorization is not a Bearer token', async () => {
    const res = await api
      .get('/api/contracts')
      .set('Authorization', 'Basic somebase64value')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/no token/i)
  })
})
