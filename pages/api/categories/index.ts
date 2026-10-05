import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin, requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { categorySchema } from '../../../lib/validations/admin'
import { logger } from '../../../lib/logger'

const SELECT =
  'id, name, sort_order, is_active, created_at, updated_at'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const auth = await requireCompanyAccess(req, res)
      const { supabase, companyId } = auth
      if (!companyId) return res.status(400).json({ error: 'Company required' })

      const includeInactive = req.query.all === '1' || req.query.all === 'true'
      let query = supabase
        .from('profe_categories')
        .select(SELECT)
        .eq('company_id', companyId)
        .order('sort_order')
        .order('name')

      if (!includeInactive) query = query.eq('is_active', true)

      const { data, error } = await query
      if (error) {
        logger.error('List categories failed', { error: error.message })
        return res.status(500).json({ error: 'No se pudieron listar categorías' })
      }
      return res.status(200).json({ categories: data ?? [] })
    }

    if (req.method === 'POST') {
      const auth = await requireAdmin(req, res)
      const { supabase, companyId } = auth
      if (!companyId) return res.status(400).json({ error: 'Company required' })

      const parsed = categorySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validación fallida',
          details: parsed.error.flatten(),
        })
      }

      const { data, error } = await supabase
        .from('profe_categories')
        .insert({
          company_id: companyId,
          name: parsed.data.name.trim(),
          sort_order: parsed.data.sort_order ?? 0,
          is_active: Boolean(parsed.data.is_active),
        })
        .select(SELECT)
        .single()

      if (error || !data) {
        logger.error('Create category failed', { error: error?.message })
        if (error?.code === '23505') {
          return res.status(409).json({ error: 'Ya existe esa categoría' })
        }
        return res.status(500).json({ error: 'No se pudo crear la categoría' })
      }
      return res.status(201).json({ category: data })
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
      ].includes(error.message)
    ) {
      return
    }
    if (!res.headersSent) return res.status(500).json({ error: 'Error interno' })
  }
}
