import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided.' })
  }
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'dev-secret')
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' })
  }
}
