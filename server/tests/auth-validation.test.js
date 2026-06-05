import { describe, it, expect } from 'vitest'
import supertest from 'supertest'
import app from '../app.js'

const api = supertest(app)

// These tests exercise the Zod validation middleware on POST /api/auth/register.
// They never reach the Supabase layer — a 400 is returned before any DB call.

describe('POST /api/auth/register — request validation', () => {
  it('returns 400 when body is empty', async () => {
    const res = await api.post('/api/auth/register').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed.')
  })

  it('rejects an invalid email', async () => {
    const res = await api.post('/api/auth/register').send({
      name: 'Test User',
      email: 'not-an-email',
      password: 'validpassword1',
      accountType: 'fighter',
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.email).toBeDefined()
  })

  it('rejects a password shorter than 8 characters', async () => {
    const res = await api.post('/api/auth/register').send({
      name: 'Test User',
      email: 'user@example.com',
      password: 'short',
      accountType: 'fighter',
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.password).toBeDefined()
  })

  it('rejects an unknown accountType', async () => {
    const res = await api.post('/api/auth/register').send({
      name: 'Test User',
      email: 'user@example.com',
      password: 'validpassword1',
      accountType: 'hacker',
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.accountType).toBeDefined()
  })

  it('rejects a subdomain that is too short', async () => {
    const res = await api.post('/api/auth/register').send({
      name: 'Test User',
      email: 'user@example.com',
      password: 'validpassword1',
      accountType: 'fighter',
      subdomain: 'ab',
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.subdomain).toBeDefined()
  })

  it('rejects a subdomain with invalid characters (underscore)', async () => {
    const res = await api.post('/api/auth/register').send({
      name: 'Test User',
      email: 'user@example.com',
      password: 'validpassword1',
      accountType: 'fighter',
      subdomain: 'my_fighter',
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.subdomain).toBeDefined()
  })
})

describe('POST /api/auth/login — request validation', () => {
  it('returns 400 when email is missing', async () => {
    const res = await api.post('/api/auth/login').send({ password: 'somepassword' })
    expect(res.status).toBe(400)
    expect(res.body.fields.email).toBeDefined()
  })

  it('returns 400 when password is missing', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'user@example.com' })
    expect(res.status).toBe(400)
    expect(res.body.fields.password).toBeDefined()
  })
})
