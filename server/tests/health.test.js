import { describe, it, expect } from 'vitest'
import supertest from 'supertest'
import app from '../app.js'

const api = supertest(app)

describe('GET /api/health', () => {
  it('returns 200 with ok:true', async () => {
    const res = await api.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('includes timestamp and env fields', async () => {
    const res = await api.get('/api/health')
    expect(typeof res.body.ts).toBe('number')
    expect(typeof res.body.env).toBe('string')
  })
})

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await api.get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Not found')
  })
})
