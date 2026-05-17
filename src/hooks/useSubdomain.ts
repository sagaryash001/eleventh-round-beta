/**
 * Detects the team subdomain from the current hostname.
 *
 * In production:  team.eleventh-rnd.com  → returns 'team'
 * In development: localhost / 127.0.0.1  → returns null
 *
 * Configure your DNS with a wildcard A-record:
 *   *.eleventh-rnd.com → your server IP
 * and a wildcard SSL cert (Let's Encrypt wildcard or Cloudflare proxy).
 */

const PROD_DOMAIN = (import.meta as any).env?.VITE_DOMAIN ?? 'eleventh-rnd.com'
const IGNORED     = ['www', 'app', 'api', 'staging', 'dev']

export function useSubdomain(): string | null {
  const hostname = window.location.hostname

  // Local dev — no subdomains
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return null
  }

  // Must end with the production domain
  if (!hostname.endsWith(`.${PROD_DOMAIN}`)) return null

  const sub = hostname.slice(0, hostname.length - PROD_DOMAIN.length - 1)

  // Single-level subdomain only, not ignored
  if (!sub || sub.includes('.') || IGNORED.includes(sub)) return null

  return sub
}
