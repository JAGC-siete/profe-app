const NOREPLY_EMAIL = 'noreply@humanosisu.net'
const CONTACT_EMAIL = 'humanosisu@humanosisu.net'

function extractEmail(from: string): string | null {
  const angle = from.match(/<([^>]+)>/)
  if (angle?.[1]) return angle[1].trim()
  const trimmed = from.trim()
  return trimmed.includes('@') ? trimmed : null
}

/** Remitente transaccional: planes de entrenamiento, notificaciones. */
export function getResendFromNoreply(options?: { displayName?: string }): string {
  const configured = process.env.RESEND_FROM_NOREPLY?.trim()
  if (configured) return configured
  const name = options?.displayName ?? 'Profe App'
  return `${name} <${NOREPLY_EMAIL}>`
}

export function getResendFromContact(): string {
  const configured =
    process.env.RESEND_FROM_CONTACT?.trim() || process.env.RESEND_FROM?.trim()
  if (configured) return configured
  return `Profe App <${CONTACT_EMAIL}>`
}

export function getResendNoreplyEmail(): string {
  return extractEmail(getResendFromNoreply()) ?? NOREPLY_EMAIL
}

export function getResendContactEmail(): string {
  return extractEmail(getResendFromContact()) ?? CONTACT_EMAIL
}
