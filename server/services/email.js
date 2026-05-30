import nodemailer from 'nodemailer'

const FROM    = process.env.FROM_EMAIL  || 'contact@eleventh-rnd.us'
const CLIENT  = process.env.CLIENT_URL  || 'http://localhost:5173'

// Lazily create the transporter so the server boots fine without email config.
// Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS in .env.
// For Gmail: host=smtp.gmail.com port=465 secure=true, use an App Password.
let _transport = null
function transport() {
  if (!_transport) {
    const host = process.env.EMAIL_HOST
    const user = process.env.EMAIL_USER
    const pass = process.env.EMAIL_PASS
    if (!host || !user || !pass) return null
    _transport = nodemailer.createTransport({
      host,
      port:   Number(process.env.EMAIL_PORT  || 465),
      secure: process.env.EMAIL_SECURE !== 'false', // true by default (SSL)
      auth:   { user, pass },
    })
  }
  return _transport
}

async function send(to, subject, html) {
  const t = transport()
  if (!t) {
    console.warn('[email] EMAIL_HOST/USER/PASS not set — skipping email to', to)
    return
  }
  await t.sendMail({ from: `"The Eleventh Round" <${FROM}>`, to, subject, html })
}

// Generic plain-text/html email for outbox dispatcher use
export async function sendEmail(to, subject, html) {
  return send(to, subject, html)
}

// ── Shared HTML shell ─────────────────────────────────────────────────────────
function shell(body) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0d0d0f;border:1px solid #222226;border-left:2px solid #8b0000;max-width:100%">
        <tr><td style="padding:28px 36px 20px">
          <div style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;color:#f0ece4">
            ELEVENTH&nbsp;<span style="color:#C41E3A">ROUND</span>
          </div>
          <div style="height:1px;background:linear-gradient(to right,#8b0000,transparent);margin-top:12px"></div>
        </td></tr>
        <tr><td style="padding:20px 36px 32px;color:#b8b4ae;font-size:14px;line-height:1.7">
          ${body}
        </td></tr>
        <tr><td style="padding:16px 36px 24px;border-top:1px solid #1a1a1d">
          <div style="font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#4a4846">
            © The Eleventh Round · Career Infrastructure · Combat Sports
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Verification email ────────────────────────────────────────────────────────
export async function sendVerificationEmail(to, name, verifyUrlOrToken) {
  const url = verifyUrlOrToken?.startsWith('http')
    ? verifyUrlOrToken
    : `${CLIENT}/verify-email?token=${verifyUrlOrToken}`
  await send(to, 'Verify your Eleventh Round account', shell(`
    <p>Hey <strong style="color:#f0ece4">${name}</strong>,</p>
    <p>Your account has been created. Click below to verify your email address and unlock your dashboard.</p>
    <div style="margin:28px 0">
      <a href="${url}"
         style="display:inline-block;background:#8b0000;color:#f0ece4;text-decoration:none;
                padding:14px 28px;font-size:11px;font-weight:700;letter-spacing:0.2em;
                text-transform:uppercase">
        Verify Email &rarr;
      </a>
    </div>
    <p style="font-size:12px;color:#4a4846">
      Or paste this link into your browser:<br>
      <span style="color:#7a7672">${url}</span>
    </p>
    <p style="font-size:12px;color:#4a4846;margin-top:20px">
      If you didn&rsquo;t create an account, you can safely ignore this email.
    </p>
  `))
}

// ── Welcome email ─────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(to, name, role, subdomain) {
  const dashUrl = subdomain
    ? `https://${subdomain}.eleventh-rnd.com`
    : `${CLIENT}/dashboard/${role || 'fighter'}`

  await send(to, "You're in. Welcome to The Eleventh Round.", shell(`
    <p>Welcome, <strong style="color:#f0ece4">${name}</strong>.</p>
    <p>Your account is verified and active. You&rsquo;re now part of the only platform
       built around fighter readiness, manager systems, and long-term career development.</p>
    ${subdomain ? `
      <p style="margin:20px 0;padding:16px;background:#141416;border-left:2px solid #8b0000">
        <span style="font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#4a4846;display:block;margin-bottom:4px">Your team subdomain</span>
        <strong style="color:#C41E3A;font-size:15px">${subdomain}.eleventh-rnd.com</strong>
      </p>
    ` : ''}
    <div style="margin:28px 0">
      <a href="${dashUrl}"
         style="display:inline-block;background:#8b0000;color:#f0ece4;text-decoration:none;
                padding:14px 28px;font-size:11px;font-weight:700;letter-spacing:0.2em;
                text-transform:uppercase">
        Access Dashboard &rarr;
      </a>
    </div>
    <p style="font-size:12px;color:#4a4846">
      Professionalism creates opportunity. Readiness is the differentiator.
    </p>
  `))
}
