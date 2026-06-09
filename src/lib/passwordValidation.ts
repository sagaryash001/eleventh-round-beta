// ─────────────────────────────────────────────────────────────────────────────
// Shared password validation — used on signup and reset-password pages.
// ─────────────────────────────────────────────────────────────────────────────

export interface PasswordRule {
  id:     string
  label:  string
  test:   (pw: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length',  label: 'At least 8 characters',      test: pw => pw.length >= 8 },
  { id: 'upper',   label: 'Uppercase letter (A–Z)',      test: pw => /[A-Z]/.test(pw) },
  { id: 'lower',   label: 'Lowercase letter (a–z)',      test: pw => /[a-z]/.test(pw) },
  { id: 'number',  label: 'Number (0–9)',                test: pw => /[0-9]/.test(pw) },
  { id: 'special', label: 'Special character (!@#$…)',   test: pw => /[^A-Za-z0-9]/.test(pw) },
]

/** Returns true only if all rules pass. */
export function validatePassword(pw: string): boolean {
  return PASSWORD_RULES.every(r => r.test(pw))
}

/** Returns each rule with a `passed` flag for UI rendering. */
export function getPasswordRules(pw: string) {
  return PASSWORD_RULES.map(r => ({ ...r, passed: r.test(pw) }))
}
