import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { logger } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId } = auth
    const id = typeof req.query.id === 'string' ? req.query.id : ''

    if (!companyId || !id) {
      return res.status(400).json({ error: 'Parámetros inválidos' })
    }

    if (req.method === 'GET') {
      const { data: session, error } = await supabase
        .from('training_sessions')
        .select(
          `
          id, coach_name, category, scheduled_date,
          general_objective, physical_objective, devotional_theme,
          created_at, updated_at,
          training_phases (
            id, phase_name, explanation, variants_materials,
            diagram_image_url, sort_order
          )
        `
        )
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle()

      if (error) {
        logger.error('Get session failed', { error: error.message, id })
        return res.status(500).json({ error: 'Error al cargar sesión' })
      }
      if (!session) {
        return res.status(404).json({ error: 'Sesión no encontrada' })
      }

      const phases = Array.isArray(session.training_phases)
        ? [...session.training_phases].sort(
            (a: { sort_order: number }, b: { sort_order: number }) =>
              a.sort_order - b.sort_order
          )
        : []

      return res.status(200).json({ session: { ...session, phases } })
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId)

      if (error) {
        logger.error('Delete session failed', { error: error.message, id })
        return res.status(500).json({ error: 'No se pudo eliminar' })
      }
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'COMPANY_ACCESS_REQUIRED'].includes(error.message)
    ) {
      return
    }
    logger.error('entrenamientos [id] error', { error: String(error) })
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error interno' })
    }
  }
}
