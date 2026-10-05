import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../lib/auth/api-auth-fixed'
import { logger } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireAdmin(req, res)
    const { supabase, companyId } = auth
    if (!companyId) return res.status(400).json({ error: 'Company required' })

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthStartIso = monthStart.toISOString().slice(0, 10)

    const [
      playersRes,
      coachesRes,
      categoriesRes,
      drillsRes,
      sessionsRes,
      monthSessionsRes,
    ] = await Promise.all([
      supabase
        .from('profe_players')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true),
      supabase
        .from('profe_coaches')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true),
      supabase
        .from('profe_categories')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true),
      supabase
        .from('profe_drills')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId),
      supabase
        .from('profe_training_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_archived', false)
        .eq('is_template', false),
      supabase
        .from('profe_training_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_archived', false)
        .eq('is_template', false)
        .gte('scheduled_date', monthStartIso),
    ])

    const err =
      playersRes.error ||
      coachesRes.error ||
      categoriesRes.error ||
      drillsRes.error ||
      sessionsRes.error ||
      monthSessionsRes.error
    if (err) {
      logger.error('Admin stats failed', { error: err.message })
      return res.status(500).json({ error: 'No se pudieron cargar estadísticas' })
    }

    return res.status(200).json({
      stats: {
        players_active: playersRes.count ?? 0,
        coaches_active: coachesRes.count ?? 0,
        categories_active: categoriesRes.count ?? 0,
        drills: drillsRes.count ?? 0,
        sessions_active: sessionsRes.count ?? 0,
        sessions_this_month: monthSessionsRes.count ?? 0,
      },
    })
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
