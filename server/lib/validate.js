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
  accountType: z.enum(['fighter', 'management', 'promotion', 'sponsor']),
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

// ── Onboarding schemas ───────────────────────────────────────────────────────

export const FighterOnboardSchema = z.object({
  full_name:            z.string().trim().min(1, 'Name is required.').max(120),
  nickname:             z.string().trim().max(60).optional().nullable(),
  sport:                z.enum(['mma', 'boxing', 'bjj', 'muay_thai', 'wrestling', 'other']),
  level:                z.enum(['amateur', 'pro']),
  weight_class:         z.string().trim().min(1, 'Weight class is required.').max(60),
  record_wins:          z.number().int().min(0).default(0),
  record_losses:        z.number().int().min(0).default(0),
  record_draws:         z.number().int().min(0).default(0),
  base_city:            z.string().trim().max(120).optional().nullable(),
  gym_name:             z.string().trim().max(120).optional().nullable(),
  bio:                  z.string().trim().max(2000).optional().nullable(),
  manager_status:       z.enum(['has_manager', 'needs_manager', 'self_manages']),
  manager_name:         z.string().trim().max(120).optional().nullable(),
  manager_email:        z.string().email().optional().nullable().or(z.literal('')),
  instagram_handle:     z.string().trim().max(60).optional().nullable(),
  instagram_followers:  z.number().int().min(0).default(0),
  tiktok_handle:        z.string().trim().max(60).optional().nullable(),
  youtube_handle:       z.string().trim().max(60).optional().nullable(),
  has_upcoming_event:   z.boolean().default(false),
  event_date:           z.string().optional().nullable(),
  event_name:           z.string().trim().max(200).optional().nullable(),
  goal:                 z.string().trim().max(1000).optional().nullable(),
})

export const ManagerOnboardSchema = z.object({
  manager_name:      z.string().trim().min(1, 'Your name is required.').max(120),
  team_name:         z.string().trim().min(1, 'Team or organization name is required.').max(120),
  manager_type:      z.enum(['agent', 'coach', 'gym', 'mentor', 'team', 'promotion']),
  location:          z.string().trim().max(120).optional().nullable(),
  primary_sport:     z.string().trim().max(60).optional().nullable(),
  fighter_count:     z.number().int().min(0).default(0),
  website_or_social: z.string().trim().max(200).optional().nullable(),
  team_slug:         z.string().trim()
                      .regex(/^[a-z0-9-]{3,40}$/, 'Use 3–40 lowercase letters, numbers, or hyphens.')
                      .optional().nullable(),
})

// ── Admin schemas ────────────────────────────────────────────────────────────

export const ModuleCreateSchema = z.object({
  name:           z.string().trim().min(1, 'Name is required.').max(200),
  description:    z.string().trim().max(2000).optional().nullable(),
  category:       z.string().trim().max(60).optional().nullable(),
  order_num:      z.number().int().min(1).default(100),
  is_published:   z.boolean().default(false),
  estimated_mins: z.number().int().min(0).optional().nullable(),
  content_url:    z.string().trim().max(500).optional().nullable(),
})

export const PackageCreateSchema = z.object({
  name:             z.string().trim().min(1, 'Package name is required.').max(120),
  audience:         z.enum(['fighter', 'manager', 'sponsor', 'all']),
  description:      z.string().trim().max(2000).optional().nullable(),
  price_cents:      z.number().int().min(0, 'Price must be ≥ 0.'),
  billing_interval: z.enum(['monthly', 'annual', 'one_time']),
  features:         z.array(z.string().trim().max(200)).default([]),
  active:           z.boolean().default(true),
  sort_order:       z.number().int().min(0).default(100),
})

export const SponsorOnboardSchema = z.object({
  company_name:            z.string().trim().min(1, 'Company name is required.').max(120),
  industry:                z.string().trim().max(80).optional().nullable(),
  website_url:             z.string().trim().max(200).optional().nullable(),
  description:             z.string().trim().max(2000).optional().nullable(),
  hq_country:              z.string().trim().max(60).optional().nullable(),
  hq_region:               z.string().trim().max(60).optional().nullable(),
  budget_min_usd:          z.union([z.number(), z.string()]).optional().nullable(),
  budget_max_usd:          z.union([z.number(), z.string()]).optional().nullable(),
  preferred_weight_classes: z.array(z.string()).default([]),
  preferred_promotions:    z.array(z.string()).default([]),
  campaign_goals:          z.array(z.string()).default([]),
})

export { z }
