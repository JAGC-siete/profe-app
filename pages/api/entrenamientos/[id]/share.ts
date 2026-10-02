import type { NextApiRequest, NextApiResponse } from 'next'
import { Resend } from 'resend'
import { requireCompanyAccess } from '../../../../lib/auth/api-auth-fixed'
import { shareSessionSchema } from '../../../../lib/validations/training-session'
import { getResendFromNoreply } from '../../../../lib/resend-from'
import { formatDateOnlyForHonduras } from '../../../../lib/timezone'
import { logger } from '../../../../lib/logger'
import { env } from '../../../../lib/env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId } = auth
    const id = typeof req.query.id === 'string' ? req.query.id : ''

    if (!companyId || !id) {
      return res.status(400).json({ error: 'Parámetros inválidos' })
    }

    const parsed = shareSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validación fallida',
        details: parsed.error.flatten(),
      })
    }

    if (!env.RESEND_API_KEY) {
      return res.status(503).json({ error: 'Email no configurado (RESEND_API_KEY)' })
    }

    const { data: session, error } = await supabase
      .from('training_sessions')
      .select(
        `
        id, coach_name, category, scheduled_date,
        general_objective, physical_objective, devotional_theme,
        training_phases (phase_name, explanation, variants_materials, sort_order)
      `
      )
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error || !session) {
      return res.status(404).json({ error: 'Sesión no encontrada' })
    }

    const phases = Array.isArray(session.training_phases)
      ? [...session.training_phases].sort(
          (a: { sort_order: number }, b: { sort_order: number }) =>
            a.sort_order - b.sort_order
        )
      : []

    const dateLabel = formatDateOnlyForHonduras(session.scheduled_date)
    const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    const link = `${siteUrl}/app/entrenamientos/${session.id}`

    const phasesHtml = phases
      .map(
        (p: {
          phase_name: string
          explanation: string
          variants_materials: string
        }) => `
        <h3 style="margin:16px 0 4px;color:#065f46">${p.phase_name}</h3>
        <p style="margin:0 0 4px">${escapeHtml(p.explanation)}</p>
        ${
          p.variants_materials
            ? `<p style="margin:0;color:#555"><strong>Materiales:</strong> ${escapeHtml(p.variants_materials)}</p>`
            : ''
        }
      `
      )
      .join('')

    const note = parsed.data.message
      ? `<p style="margin:12px 0;padding:12px;background:#ecfdf5;border-radius:8px">${escapeHtml(parsed.data.message)}</p>`
      : ''

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#111">
        <h1 style="color:#047857;font-size:22px">Plan de entrenamiento — ${escapeHtml(session.category)}</h1>
        <p><strong>Fecha:</strong> ${dateLabel}<br/>
        <strong>Entrenador:</strong> ${escapeHtml(session.coach_name)}</p>
        ${note}
        <p><strong>Objetivo general:</strong> ${escapeHtml(session.general_objective)}</p>
        ${
          session.physical_objective
            ? `<p><strong>Objetivo físico:</strong> ${escapeHtml(session.physical_objective)}</p>`
            : ''
        }
        ${
          session.devotional_theme
            ? `<p><strong>Tema devocional:</strong> ${escapeHtml(session.devotional_theme)}</p>`
            : ''
        }
        ${phasesHtml}
        <p style="margin-top:24px"><a href="${link}" style="color:#059669">Ver hoja completa</a></p>
      </div>
    `

    const resend = new Resend(env.RESEND_API_KEY)
    const { error: sendError } = await resend.emails.send({
      from: getResendFromNoreply({ displayName: 'Profe App' }),
      to: parsed.data.to,
      subject: `Entrenamiento ${session.category} — ${dateLabel}`,
      html,
    })

    if (sendError) {
      logger.error('Share email failed', { error: sendError.message, id })
      return res.status(500).json({ error: 'No se pudo enviar el email' })
    }

    logger.info('Session shared', { id, recipients: parsed.data.to.length })
    return res.status(200).json({ success: true })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'COMPANY_ACCESS_REQUIRED'].includes(error.message)
    ) {
      return
    }
    logger.error('share error', { error: String(error) })
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error interno' })
    }
  }
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
