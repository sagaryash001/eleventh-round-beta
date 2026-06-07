// ─────────────────────────────────────────────────────────────────────────────
// Upload signing — generates Supabase Storage signed upload URLs.
//
// Flow:
//   1. Frontend POSTs { type, contentType } to /api/uploads/sign
//   2. Backend validates ownership, generates a safe path, issues signed URL
//   3. Frontend PUTs the file directly to the signed URL (no service key exposed)
//   4. Frontend saves the returned path to the relevant profile field
//
// Buckets:
//   public-assets      — fighter headshots, banners, sponsor logos (public read)
//   obligation-proofs  — obligation proof files (public read for V1)
//   education-content  — admin module PDFs (public read)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express'
import { adminSupabase } from '../db/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { childLogger } from '../lib/logger.js'

const router = Router()
const log    = childLogger('uploads')

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_PDF_TYPES   = ['application/pdf']
const MAX_IMAGE_BYTES     = 5 * 1024 * 1024   // 5 MB
const MAX_PDF_BYTES       = 10 * 1024 * 1024  // 10 MB

const EXT_MAP = {
  'image/jpeg':       'jpg',
  'image/png':        'png',
  'image/webp':       'webp',
  'image/gif':        'gif',
  'application/pdf':  'pdf',
}

const UPLOAD_TYPES = {
  'fighter-headshot':  { bucket: 'public-assets',     prefix: 'headshots',    allowedTypes: ALLOWED_IMAGE_TYPES, maxBytes: MAX_IMAGE_BYTES, role: 'fighter' },
  'fighter-banner':    { bucket: 'public-assets',     prefix: 'banners',      allowedTypes: ALLOWED_IMAGE_TYPES, maxBytes: MAX_IMAGE_BYTES, role: 'fighter' },
  'fighter-media-kit': { bucket: 'public-assets',     prefix: 'media-kits',   allowedTypes: ALLOWED_PDF_TYPES,   maxBytes: MAX_PDF_BYTES,   role: 'fighter' },
  'sponsor-logo':      { bucket: 'public-assets',     prefix: 'sponsor-logos', allowedTypes: ALLOWED_IMAGE_TYPES, maxBytes: MAX_IMAGE_BYTES, role: 'sponsor' },
  'obligation-proof':  { bucket: 'obligation-proofs', prefix: 'proofs',       allowedTypes: [...ALLOWED_IMAGE_TYPES, ...ALLOWED_PDF_TYPES], maxBytes: MAX_PDF_BYTES, role: null },
  'module-pdf':        { bucket: 'education-content', prefix: 'modules',      allowedTypes: ALLOWED_PDF_TYPES,   maxBytes: MAX_PDF_BYTES,   role: 'admin' },
}

// ── POST /api/uploads/sign — generate a signed upload URL ────────────────────
// Body: { type, contentType, obligation_id? }
// Returns: { signedUrl, path, bucket, maxBytes }
router.post('/sign', requireAuth, async (req, res) => {
  try {
    const sb = adminSupabase
    if (!sb) return res.status(503).json({ error: 'Storage not configured.' })

    const { type, contentType, obligation_id } = req.body
    if (!type || !contentType) return res.status(400).json({ error: 'type and contentType required.' })

    const config = UPLOAD_TYPES[type]
    if (!config) return res.status(400).json({ error: `Unknown upload type: ${type}` })

    // Role check
    if (config.role && req.user.role !== config.role && req.user.role !== 'admin') {
      return res.status(403).json({ error: `Only ${config.role}s can upload ${type}.` })
    }

    // Content-type check
    if (!config.allowedTypes.includes(contentType)) {
      return res.status(400).json({ error: `${contentType} not allowed for ${type}. Allowed: ${config.allowedTypes.join(', ')}` })
    }

    // For obligation proofs, verify ownership
    if (type === 'obligation-proof') {
      if (!obligation_id) return res.status(400).json({ error: 'obligation_id required for obligation-proof uploads.' })
      const { data: ob } = await sb
        .from('obligations').select('owner_id').eq('id', obligation_id).maybeSingle()
      if (!ob) return res.status(404).json({ error: 'Obligation not found.' })
      if (ob.owner_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not your obligation.' })
      }
    }

    const ext       = EXT_MAP[contentType] ?? 'bin'
    const timestamp = Date.now()
    const rand      = Math.random().toString(36).slice(2, 8)
    const path      = `${config.prefix}/${req.user.id}/${timestamp}-${rand}.${ext}`

    const { data, error } = await sb.storage
      .from(config.bucket)
      .createSignedUploadUrl(path)

    if (error) throw error

    log.info({ uid: req.user.id, type, bucket: config.bucket, path }, 'signed upload URL issued')
    res.json({
      ok:         true,
      signedUrl:  data.signedUrl,
      path,
      bucket:     config.bucket,
      maxBytes:   config.maxBytes,
    })
  } catch (err) {
    log.error({ err }, 'POST /uploads/sign threw')
    res.status(500).json({ error: err.message })
  }
})

export default router
