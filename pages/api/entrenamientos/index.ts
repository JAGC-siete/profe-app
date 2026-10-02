import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { trainingSessionSchema } from '../../../lib/validations/training-session'
import { logger } from '../../../lib/logger'
import { getTodayInHonduras } from '../../../lib/timezone'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId, user } = auth

    if (!companyId) {
      return res.status(400).json({ error: 'Company required' })
    }

    if (req.method === 'GET') {
      const category =
        typeof req.query.category === 'string' ? req.query.category.trim() : ''

      let query = supabase
        .from('training_sessions')
        .select(
          'id, coach_name, category, scheduled_date, general_objective, physical_objective, devotional_theme, created_at'
        )
        .eq('company_id', companyId)
        .order('scheduled_date', { ascending: false })

      if (category && category !== 'all') {
        query = query.eq('category', category)
      }

      const { data, error } = await query
      if (error) {
        logger.error('List sessions failed', { error: error.message, companyId })
        return res.status(500).json({ error: 'No se pudieron listar sesiones' })
      }

      return res.status(200).json({ sessions: data ?? [] })
    }

    if (req.method === 'POST') {
      const parsed = trainingSessionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validación fallida',
          details: parsed.error.flatten(),
        })
      }

      const input = parsed.data
      const scheduledDate = input.scheduled_date || getTodayInHonduras()

      const { data: session, error: sessionError } = await supabase
        .from('training_sessions')
        .insert({
          company_id: companyId,
          created_by: user.id,
          coach_name: input.coach_name,
          category: input.category,
          scheduled_date: scheduledDate,
          general_objective: input.general_objective,
          physical_objective: input.physical_objective,
          devotional_theme: input.devotional_theme,
        })
        .select('id')
        .single()

      if (sessionError || !session) {
        logger.error('Create session failed', {
          error: sessionError?.message,
          companyId,
        })
        return res.status(500).json({ error: 'No se pudo crear la sesión' })
      }

      const phases = input.phases.map((phase, index) => ({
        session_id: session.id,
        company_id: companyId,
        phase_name: phase.phase_name,
        explanation: phase.explanation,
        variants_materials: phase.variants_materials,
        diagram_image_url: phase.diagram_image_url || null,
        sort_order: phase.sort_order ?? index,
      }))

      const { error: phasesError } = await supabase.from('training_phases').insert(phases)

      if (phasesError) {
        logger.error('Create phases failed', {
          error: phasesError.message,
          sessionId: session.id,
        })
        await supabase.from('training_sessions').delete().eq('id', session.id)
        return res.status(500).json({ error: 'No se pudieron guardar las fases' })
      }

      logger.info('Session created', { sessionId: session.id, companyId })
      return res.status(201).json({ id: session.id })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'COMPANY_ACCESS_REQUIRED'].includes(error.message)
    ) {
      return
    }
    logger.error('entrenamientos index error', { error: String(error) })
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error interno' })
    }
  }
}
