import { describe, it, expect } from 'vitest'
import { blockIfActiveManager, ALREADY_MANAGED_MSG } from '../lib/roster.js'

// The one-manager rule: a fighter may have at most one ACTIVE manager. The pure
// decision is unit-tested here; the DB side-effects live in activateConnection.
describe('roster one-manager rule — blockIfActiveManager', () => {
  it('allows activation when the fighter has no active manager', () => {
    expect(blockIfActiveManager(null)).toBeNull()
  })

  it('blocks activation with a 409 when an active manager already exists', () => {
    const result = blockIfActiveManager({ id: 'conn-1', manager_id: 'mgr-1' })
    expect(result).toEqual({ error: ALREADY_MANAGED_MSG, status: 409 })
  })

  it('returns a clear, non-secret-leaking message', () => {
    const result = blockIfActiveManager({ id: 'conn-2', manager_id: 'mgr-2' })
    expect(result.error).toBe('This fighter is already connected to a manager.')
  })
})
