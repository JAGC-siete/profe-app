import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin, requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { coachUpdateSchema } from '../../../lib/validations/admin'
import { logger } from '../../../lib/logger'

const SELECT = 'id, full_name, category, notes, is_active, created_at'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id) return res.status(400).json({ error: 'ID requerido' })

    if (req.method === 'PATCH' || req.method === 'DELETE') {
      const auth = await requireAdmin(req, res)
      const { supabase, companyId } = auth
      if (!companyId) return res.status(400).json({ error: 'Company required' })

      if (req.method === 'DELETE') {
        const { data, error } = await supabase
          .from('profe_coaches')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('company_id', companyId)
          .select(SELECT)
          .maybeSingle()
        if (error) {
          logger.error('Soft delete coach failed', { error: error.message, id })
          return res.status(500).json({ error: 'No se pudo dar de baja' })
        }
        if (!data) return res.status(404).json({ error: 'Profe no encontrado' })
        return res.status(200).json({ coach: data })
      }

      const parsed = coachUpdateSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validación fallida',
          details: parsed.error.flatten(),
        })
      }
      const input = parsed.data
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (input.full_name !== undefined) patch.full_name = input.full_name.trim()
      if (input.category !== undefined) patch.category = input.category.trim()
      if (input.notes !== undefined) patch.notes = input.notes
      if (input.is_active !== undefined) patch.is_active = Boolean(input.is_active)

      const { data, error } = await supabase
        .from('profe_coaches')
        .update(patch)
        .eq('id', id)
        .eq('company_id', companyId)
        .select(SELECT)
        .maybeSingle()

      if (error) {
        logger.error('Update coach failed', { error: error.message, id })
        return res.status(500).json({ error: 'No se pudo actualizar' })
      }
      if (!data) return res.status(404).json({ error: 'Profe no encontrado' })
      return res.status(200).json({ coach: data })
    }

    if (req.method === 'GET') {
      const auth = await requireCompanyAccess(req, res)
      const { supabase, companyId } = auth
      if (!companyId) return res.status(400).json({ error: 'Company required' })
      const { data, error } = await supabase
        .from('profe_coaches')
        .select(SELECT)
        .eq('id', id)
        .eq('company_id', companyId)
        .maybeSingle()
      if (error) {
        logger.error('Get coach failed', { error: error.message, id })
        return res.status(500).json({ error: 'No se pudo cargar' })
      }
      if (!data) return res.status(404).json({ error: 'Profe no encontrado' })
      return res.status(200).json({ coach: data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    if (
      error instanceof Error &&
      [
        'UNAUTHORIZED',
        'PROFILE_REQUIRED',
        'COMPANY_ACCESS_REQUIRED',
        'ADMIN_REQUIRED',
        'ACCOUNT_DEACTIVATED',
      ].includes(error.message)
    ) {
      return
    }
    if (!res.headersSent) return res.status(500).json({ error: 'Error interno' })
  }
}
