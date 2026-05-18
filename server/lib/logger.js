// ─────────────────────────────────────────────────────────────────────────────
// Structured logger (pino)
//
// In dev: pretty-printed, colorized output via pino-pretty.
// In prod: NDJSON to stdout, consumable by Render/Fly/Datadog/etc.
// ─────────────────────────────────────────────────────────────────────────────

import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base:  { service: 'er-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      '*.password',
      '*.password_hash',
    ],
    censor: '[REDACTED]',
  },
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
    : undefined,
})

// Convenience: child logger per route module
export function childLogger(module) {
  return logger.child({ module })
}
