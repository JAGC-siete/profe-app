import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { playerSchema } from '../../../lib/validations/training-session'
import { logger } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId } = auth
    if (!companyId) return res.status(400).json({ error: 'Company required' })

    if (req.method === 'GET') {
      const category =
        typeof req.query.category === 'string' ? req.query.category.trim() : ''
      let query = supabase
        .from('profe_players')
        .select('id, name, category, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name')
      if (category) query = query.eq('category', category)
      const { data, error } = await query
      if (error) {
        logger.error('List players failed', { error: error.message })
        return res.status(500).json({ error: 'No se pudieron listar jugadores' })
      }
      return res.status(200).json({ players: data ?? [] })
    }

    if (req.method === 'POST') {
      const parsed = playerSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validación fallida', details: parsed.error.flatten() })
      }
      const { data, error } = await supabase
        .from('profe_players')
        .insert({
          company_id: companyId,
          name: parsed.data.name,
          category: parsed.data.category,
          is_active: Boolean(parsed.data.is_active),
        })
        .select('id, name, category, is_active')
        .single()
      if (error || !data) {
        logger.error('Create player failed', { error: error?.message })
        return res.status(500).json({ error: 'No se pudo crear jugador' })
      }
      return res.status(201).json({ player: data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'COMPANY_ACCESS_REQUIRED'].includes(error.message)
    ) {
      return
    }
    if (!res.headersSent) return res.status(500).json({ error: 'Error interno' })
  }
}
