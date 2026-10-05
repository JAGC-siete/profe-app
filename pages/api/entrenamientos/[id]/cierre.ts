import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../../lib/auth/api-auth-fixed'
import {
  attendanceSchema,
  sessionReviewSchema,
} from '../../../../lib/validations/training-session'
import { logger } from '../../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId, user } = auth
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!companyId || !id) return res.status(400).json({ error: 'Parámetros inválidos' })

    const { data: session } = await supabase
      .from('profe_training_sessions')
      .select('id, category')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })

    if (req.method === 'GET') {
      const [{ data: attendance }, { data: review }, { data: players }] = await Promise.all([
        supabase
          .from('profe_session_attendance')
          .select('player_id, present')
          .eq('session_id', id)
          .eq('company_id', companyId),
        supabase
          .from('profe_session_reviews')
          .select('intensity, objective_met, notes')
          .eq('session_id', id)
          .eq('company_id', companyId)
          .maybeSingle(),
        supabase
          .from('profe_players')
          .select('id, name, category, is_active')
          .eq('company_id', companyId)
          .eq('category', session.category)
          .eq('is_active', true)
          .order('name'),
      ])
      return res.status(200).json({
        players: players ?? [],
        attendance: attendance ?? [],
        review: review ?? null,
        category: session.category,
      })
    }

    if (req.method === 'POST') {
      const { attendance, review } = req.body ?? {}

      if (attendance) {
        const parsedAtt = attendanceSchema.safeParse(attendance)
        if (!parsedAtt.success) {
          return res.status(400).json({ error: 'Asistencia inválida' })
        }
        await supabase
          .from('profe_session_attendance')
          .delete()
          .eq('session_id', id)
          .eq('company_id', companyId)
        if (parsedAtt.data.entries.length > 0) {
          const { error } = await supabase.from('profe_session_attendance').insert(
            parsedAtt.data.entries.map((e) => ({
              company_id: companyId,
              session_id: id,
              player_id: e.player_id,
              present: e.present,
            }))
          )
          if (error) {
            logger.error('Save attendance failed', { error: error.message })
            return res.status(500).json({ error: 'No se pudo guardar asistencia' })
          }
        }
      }

      if (review) {
        const parsedRev = sessionReviewSchema.safeParse(review)
        if (!parsedRev.success) {
          return res.status(400).json({ error: 'Review inválido' })
        }
        const { error } = await supabase.from('profe_session_reviews').upsert(
          {
            company_id: companyId,
            session_id: id,
            intensity: parsedRev.data.intensity,
            objective_met: parsedRev.data.objective_met,
            notes: parsedRev.data.notes || '',
            created_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' }
        )
        if (error) {
          logger.error('Save review failed', { error: error.message })
          return res.status(500).json({ error: 'No se pudo guardar evaluación' })
        }
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
    logger.error('cierre error', { error: String(error) })
    if (!res.headersSent) return res.status(500).json({ error: 'Error interno' })
  }
}
