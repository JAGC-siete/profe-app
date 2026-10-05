import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin, requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { isAdminRole } from '../../../lib/auth/roles'
import { playerUpdateSchema } from '../../../lib/validations/training-session'
import { logger } from '../../../lib/logger'

const PLAYER_SELECT =
  'id, name, category, jersey_number, birthdate, guardian_phone, notes, is_active, created_at'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id) return res.status(400).json({ error: 'ID requerido' })

    if (req.method === 'PATCH') {
      const auth = await requireCompanyAccess(req, res)
      const { supabase, companyId } = auth
      if (!companyId) return res.status(400).json({ error: 'Company required' })
      const parsed = playerUpdateSchema.safeParse(req.body)
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
      if (input.category !== undefined) patch.category = input.category.trim()
      if (input.jersey_number !== undefined) {
        patch.jersey_number =
          input.jersey_number == null || Number.isNaN(input.jersey_number)
            ? null
            : input.jersey_number
      }
      if (input.birthdate !== undefined) {
        patch.birthdate =
          !input.birthdate || input.birthdate === '' ? null : input.birthdate
      }
      if (input.guardian_phone !== undefined) {
        patch.guardian_phone = input.guardian_phone.trim()
      }
      if (input.notes !== undefined) patch.notes = input.notes.trim()
      if (input.is_active !== undefined) {
        if (input.is_active === false && !isAdminRole(auth.role)) {
          return res.status(403).json({ error: 'Solo admin puede dar de baja' })
        }
        patch.is_active = Boolean(input.is_active)
      }

      const { data, error } = await supabase
        .from('profe_players')
        .update(patch)
        .eq('id', id)
        .eq('company_id', companyId)
        .select(PLAYER_SELECT)
        .maybeSingle()

      if (error) {
        logger.error('Update player failed', { error: error.message, id })
        return res.status(500).json({ error: 'No se pudo actualizar' })
      }
      if (!data) return res.status(404).json({ error: 'Jugador no encontrado' })
      return res.status(200).json({ player: data })
    }

    if (req.method === 'DELETE') {
      const auth = await requireAdmin(req, res)
      const { supabase, companyId } = auth
      if (!companyId) return res.status(400).json({ error: 'Company required' })

      // Soft delete — solo admin academia
      const { data, error } = await supabase
        .from('profe_players')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('company_id', companyId)
        .select(PLAYER_SELECT)
        .maybeSingle()

      if (error) {
        logger.error('Soft delete player failed', { error: error.message, id })
        return res.status(500).json({ error: 'No se pudo dar de baja' })
      }
      if (!data) return res.status(404).json({ error: 'Jugador no encontrado' })
      return res.status(200).json({ player: data })
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
