import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../lib/auth/api-auth-fixed'
import { categoryUpdateSchema } from '../../../lib/validations/admin'
import { logger } from '../../../lib/logger'

const SELECT =
  'id, name, sort_order, is_active, created_at, updated_at'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireAdmin(req, res)
    const { supabase, companyId } = auth
    if (!companyId) return res.status(400).json({ error: 'Company required' })

    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id) return res.status(400).json({ error: 'ID requerido' })

    if (req.method === 'PATCH') {
      const parsed = categoryUpdateSchema.safeParse(req.body)
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
      if (input.name !== undefined) patch.name = input.name.trim()
      if (input.sort_order !== undefined) patch.sort_order = input.sort_order
      if (input.is_active !== undefined) patch.is_active = Boolean(input.is_active)

      const { data, error } = await supabase
        .from('profe_categories')
        .update(patch)
        .eq('id', id)
        .eq('company_id', companyId)
        .select(SELECT)
        .maybeSingle()

      if (error) {
        logger.error('Update category failed', { error: error.message, id })
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Ya existe esa categoría' })
        }
        return res.status(500).json({ error: 'No se pudo actualizar' })
      }
      if (!data) return res.status(404).json({ error: 'Categoría no encontrada' })
      return res.status(200).json({ category: data })
    }

    if (req.method === 'DELETE') {
      const { data, error } = await supabase
        .from('profe_categories')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('company_id', companyId)
        .select(SELECT)
        .maybeSingle()

      if (error) {
        logger.error('Soft delete category failed', { error: error.message, id })
        return res.status(500).json({ error: 'No se pudo dar de baja' })
      }
      if (!data) return res.status(404).json({ error: 'Categoría no encontrada' })
      return res.status(200).json({ category: data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    if (
      error instanceof Error &&
      [
        'UNAUTHORIZED',
        'PROFILE_REQUIRED',
        'ADMIN_REQUIRED',
        'ACCOUNT_DEACTIVATED',
      ].includes(error.message)
    ) {
      return
    }
    if (!res.headersSent) return res.status(500).json({ error: 'Error interno' })
  }
}
