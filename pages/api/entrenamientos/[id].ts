import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { trainingSessionSchema } from '../../../lib/validations/training-session'
import { sceneForDb } from '../../../lib/pitch/schema'
import {
  aggregateMaterials,
  parseMaterialsText,
  totalDurationMinutes,
} from '../../../lib/materials'
import { logger } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId, user } = auth
    const id = typeof req.query.id === 'string' ? req.query.id : ''

    if (!companyId || !id) {
      return res.status(400).json({ error: 'Parámetros inválidos' })
    }

    if (req.method === 'GET') {
      const { data: session, error } = await supabase
        .from('profe_training_sessions')
        .select(
          `
          id, coach_name, category, scheduled_date,
          general_objective, physical_objective, devotional_theme,
          is_template, source_session_id,
          created_at, updated_at,
          profe_training_phases (
            id, phase_name, explanation, variants_materials,
            materials_json, diagram_image_url, diagram_scene_json,
            duration_minutes, sort_order
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

      const phases = Array.isArray(session.profe_training_phases)
        ? [...session.profe_training_phases].sort(
            (a: { sort_order: number }, b: { sort_order: number }) =>
              a.sort_order - b.sort_order
          )
        : []

      const { profe_training_phases: _phases, ...sessionRow } = session
      return res.status(200).json({
        session: {
          ...sessionRow,
          phases,
          total_minutes: totalDurationMinutes(phases),
          materials: aggregateMaterials(phases),
        },
      })
    }

    if (req.method === 'PUT') {
      const parsed = trainingSessionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validación fallida',
          details: parsed.error.flatten(),
        })
      }
      const input = parsed.data

      const { error: updError } = await supabase
        .from('profe_training_sessions')
        .update({
          coach_name: input.coach_name,
          category: input.category,
          scheduled_date: input.scheduled_date,
          general_objective: input.general_objective,
          physical_objective: input.physical_objective,
          devotional_theme: input.devotional_theme,
          is_template: Boolean(input.is_template),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', companyId)

      if (updError) {
        logger.error('Update session failed', { error: updError.message, id })
        return res.status(500).json({ error: 'No se pudo actualizar' })
      }

      await supabase
        .from('profe_training_phases')
        .delete()
        .eq('session_id', id)
        .eq('company_id', companyId)

      const phases = input.phases.map((phase, index) => {
        const materials =
          phase.materials_json?.length > 0
            ? phase.materials_json
            : parseMaterialsText(phase.variants_materials)
        return {
          session_id: id,
          company_id: companyId,
          phase_name: phase.phase_name,
          explanation: phase.explanation,
          variants_materials: phase.variants_materials,
          materials_json: materials,
          diagram_image_url: phase.diagram_image_url || null,
          diagram_scene_json: sceneForDb(phase.diagram_scene_json),
          duration_minutes: phase.duration_minutes ?? 0,
          sort_order: phase.sort_order ?? index,
        }
      })

      const { error: phasesError } = await supabase
        .from('profe_training_phases')
        .insert(phases)

      if (phasesError) {
        logger.error('Replace phases failed', { error: phasesError.message, id })
        return res.status(500).json({ error: 'No se pudieron guardar las fases' })
      }

      return res.status(200).json({
        id,
        total_minutes: totalDurationMinutes(phases),
        updated_by: user.id,
      })
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('profe_training_sessions')
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
