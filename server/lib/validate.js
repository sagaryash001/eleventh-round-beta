// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers (zod)
//
// Usage in a route:
//   router.post('/leads',
//     validate(LeadSchema),                 // body validated + parsed
//     (req, res) => { req.valid → typed }
//   )
// ─────────────────────────────────────────────────────────────────────────────

import { z, ZodError } from 'zod'

/**
 * Middleware factory — validates `req.body` against a zod schema.
 * On success: parsed value attached to `req.valid`.
 * On failure: 400 with field errors.
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      req.valid = schema.parse(req[source])
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error:  'Validation failed.',
          fields: err.flatten().fieldErrors,
        })
      }
      next(err)
    }
  }
}

// ── Common schemas ───────────────────────────────────────────────────────────

export const EmailSchema = z.string().trim().toLowerCase().email('Invalid email address.')

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.')

export const SubdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,32}$/, 'Use 3–32 lowercase letters, digits, or hyphens.')

export const RegisterSchema = z.object({
  name:        z.string().trim().min(1, 'Name is required.').max(120),
  email:       EmailSchema,
  password:    PasswordSchema,
  accountType: z.enum(['fighter', 'management', 'promotion']),
  teamName:    z.string().trim().max(120).optional().nullable(),
  subdomain:   SubdomainSchema.optional().nullable(),
  onboarding:  z.object({
    q1: z.string().max(500).optional(),
    q2: z.string().max(500).optional(),
    q3: z.string().max(500).optional(),
    q4: z.string().max(500).optional(),
    q5: z.string().max(500).optional(),
  }).optional(),
})

export const LoginSchema = z.object({
  email:    EmailSchema,
  password: z.string().min(1, 'Password is required.'),
})

export const LeadSchema = z.object({
  name:    z.string().trim().min(1).max(120),
  email:   EmailSchema,
  phone:   z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().max(4000).optional().nullable(),
  source:  z.string().trim().max(40).optional().nullable(),
})

export const ObligationSchema = z.object({
  title:       z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  due_date:    z.string().datetime(),
  priority:    z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category:    z.string().trim().max(40).optional().nullable(),
})

export { z }
