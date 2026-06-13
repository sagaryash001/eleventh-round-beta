// ─────────────────────────────────────────────────────────────────────────────
// Server-side token encryption (AES-256-GCM).
//
// Used to encrypt third-party OAuth tokens (Calendly) at rest so the database
// never holds raw access/refresh tokens. The key comes from
// TOKEN_ENCRYPTION_KEY and is hashed to a fixed 32 bytes, so any sufficiently
// long secret works (generate with: `openssl rand -hex 32`).
//
// Format: "<iv b64>:<authTag b64>:<ciphertext b64>"
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto'

function key() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set — cannot encrypt/decrypt tokens.')
  // Derive a deterministic 32-byte key from whatever secret was provided.
  return crypto.createHash('sha256').update(String(raw)).digest()
}

export function isEncryptionConfigured() {
  return !!process.env.TOKEN_ENCRYPTION_KEY
}

export function encrypt(plain) {
  if (plain == null) return null
  const iv     = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc    = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decrypt(blob) {
  if (!blob) return null
  const [ivB64, tagB64, dataB64] = String(blob).split(':')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed ciphertext.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
