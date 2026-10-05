import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../../lib/auth/api-auth-fixed'
import { getTodayInHonduras } from '../../../../lib/timezone'
import { logger } from '../../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId, user } = auth
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    const asTemplate = req.body?.as_template === true

    if (!companyId || !id) {
      return res.status(400).json({ error: 'Parámetros inválidos' })
    }

    const { data: session, error } = await supabase
      .from('profe_training_sessions')
      .select(
        `
        coach_name, category, general_objective, physical_objective, devotional_theme,
        profe_training_phases (
          phase_name, explanation, variants_materials, materials_json,
          diagram_image_url, diagram_scene_json, duration_minutes, sort_order
        )
      `
      )
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error || !session) {
      return res.status(404).json({ error: 'Sesión no encontrada' })
    }

    const { data: created, error: createError } = await supabase
      .from('profe_training_sessions')
      .insert({
        company_id: companyId,
        created_by: user.id,
        coach_name: session.coach_name,
        category: session.category,
        scheduled_date: getTodayInHonduras(),
        general_objective: session.general_objective,
        physical_objective: session.physical_objective,
        devotional_theme: session.devotional_theme,
        is_template: asTemplate,
        source_session_id: id,
      })
      .select('id')
      .single()

    if (createError || !created) {
      logger.error('Duplicate session failed', { error: createError?.message, id })
      return res.status(500).json({ error: 'No se pudo duplicar' })
    }

    const phases = Array.isArray(session.profe_training_phases)
      ? session.profe_training_phases
      : []

    if (phases.length > 0) {
      const rows = phases.map(
        (
          p: {
            phase_name: string
            explanation: string
            variants_materials: string
            materials_json: unknown
            diagram_image_url: string | null
            diagram_scene_json?: unknown
            duration_minutes: number
            sort_order: number
          },
          index: number
        ) => ({
          session_id: created.id,
          company_id: companyId,
          phase_name: p.phase_name,
          explanation: p.explanation,
          variants_materials: p.variants_materials,
          materials_json: p.materials_json ?? [],
          diagram_image_url: p.diagram_image_url,
          diagram_scene_json: p.diagram_scene_json ?? {},
          duration_minutes: p.duration_minutes ?? 0,
          sort_order: p.sort_order ?? index,
        })
      )
      const { error: phasesError } = await supabase
        .from('profe_training_phases')
        .insert(rows)
      if (phasesError) {
        await supabase.from('profe_training_sessions').delete().eq('id', created.id)
        logger.error('Duplicate phases failed', { error: phasesError.message })
        return res.status(500).json({ error: 'No se pudieron copiar las fases' })
      }
    }

    logger.info('Session duplicated', { from: id, to: created.id, asTemplate })
    return res.status(201).json({ id: created.id })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'COMPANY_ACCESS_REQUIRED'].includes(error.message)
    ) {
      return
    }
    logger.error('duplicate error', { error: String(error) })
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error interno' })
    }
  }
}
