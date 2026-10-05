import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { coachSchema } from '../../../lib/validations/training-session'
import { logger } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId } = auth
    if (!companyId) return res.status(400).json({ error: 'Company required' })

    if (req.method === 'GET') {
      const category =
        typeof req.query.category === 'string' ? req.query.category.trim() : ''
      const includeInactive = req.query.all === '1' || req.query.all === 'true'

      let query = supabase
        .from('profe_coaches')
        .select('id, full_name, category, notes, is_active, created_at')
        .eq('company_id', companyId)
        .order('category')
        .order('full_name')

      if (!includeInactive) query = query.eq('is_active', true)
      if (category) query = query.eq('category', category)

      const { data, error } = await query
      if (error) {
        logger.error('List coaches failed', { error: error.message })
        return res.status(500).json({ error: 'No se pudieron listar profes' })
      }
      return res.status(200).json({ coaches: data ?? [] })
    }

    if (req.method === 'POST') {
      const parsed = coachSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validación fallida',
          details: parsed.error.flatten(),
        })
      }
      const { data, error } = await supabase
        .from('profe_coaches')
        .insert({
          company_id: companyId,
          full_name: parsed.data.full_name.trim(),
          category: parsed.data.category.trim(),
          notes: parsed.data.notes ?? '',
          is_active: Boolean(parsed.data.is_active),
        })
        .select('id, full_name, category, notes, is_active')
        .single()
      if (error || !data) {
        logger.error('Create coach failed', { error: error?.message })
        return res.status(500).json({ error: 'No se pudo crear el profe' })
      }
      return res.status(201).json({ coach: data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'COMPANY_ACCESS_REQUIRED'].includes(
        error.message
      )
    ) {
      return
    }
    if (!res.headersSent) return res.status(500).json({ error: 'Error interno' })
  }
}
