import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../../../lib/auth/api-auth-fixed'
import { sessionArchiveSchema } from '../../../../../lib/validations/admin'
import { logger } from '../../../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireAdmin(req, res)
    const { supabase, companyId } = auth
    if (!companyId) return res.status(400).json({ error: 'Company required' })

    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id) return res.status(400).json({ error: 'ID requerido' })

    const parsed = sessionArchiveSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validación fallida',
        details: parsed.error.flatten(),
      })
    }

    const { data, error } = await supabase
      .from('profe_training_sessions')
      .update({
        is_archived: parsed.data.is_archived,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select(
        'id, coach_name, category, scheduled_date, general_objective, is_template, is_archived, created_at'
      )
      .maybeSingle()

    if (error) {
      logger.error('Archive session failed', { error: error.message, id })
      return res.status(500).json({ error: 'No se pudo archivar' })
    }
    if (!data) return res.status(404).json({ error: 'Sesión no encontrada' })
    return res.status(200).json({ session: data })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'ADMIN_REQUIRED', 'ACCOUNT_DEACTIVATED'].includes(
        error.message
      )
    ) {
      return
    }
    if (!res.headersSent) return res.status(500).json({ error: 'Error interno' })
  }
}
