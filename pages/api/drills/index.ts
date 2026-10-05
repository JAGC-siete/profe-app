import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { drillSchema } from '../../../lib/validations/training-session'
import { parseMaterialsText } from '../../../lib/materials'
import { logger } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId, user } = auth
    if (!companyId) return res.status(400).json({ error: 'Company required' })

    if (req.method === 'GET') {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
      let query = supabase
        .from('profe_drills')
        .select(
          'id, name, explanation, variants_materials, materials_json, diagram_image_url, tags, category, created_at'
        )
        .eq('company_id', companyId)
        .order('name')

      if (q) query = query.ilike('name', `%${q}%`)

      const { data, error } = await query
      if (error) {
        logger.error('List drills failed', { error: error.message })
        return res.status(500).json({ error: 'No se pudieron listar drills' })
      }
      return res.status(200).json({ drills: data ?? [] })
    }

    if (req.method === 'POST') {
      const parsed = drillSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validación fallida', details: parsed.error.flatten() })
      }
      const input = parsed.data
      const materials =
        input.materials_json?.length > 0
          ? input.materials_json
          : parseMaterialsText(input.variants_materials)

      const { data, error } = await supabase
        .from('profe_drills')
        .insert({
          company_id: companyId,
          created_by: user.id,
          name: input.name,
          explanation: input.explanation,
          variants_materials: input.variants_materials || '',
          materials_json: materials,
          diagram_image_url: input.diagram_image_url || null,
          tags: input.tags || [],
          category: input.category || null,
        })
        .select('id')
        .single()

      if (error || !data) {
        logger.error('Create drill failed', { error: error?.message })
        return res.status(500).json({ error: 'No se pudo crear drill' })
      }
      return res.status(201).json({ id: data.id })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'COMPANY_ACCESS_REQUIRED'].includes(error.message)
    ) {
      return
    }
    logger.error('drills index error', { error: String(error) })
    if (!res.headersSent) return res.status(500).json({ error: 'Error interno' })
  }
}
