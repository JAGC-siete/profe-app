import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../lib/auth/api-auth-fixed'
import { logger } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireAdmin(req, res)
    const { supabase, companyId } = auth
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!companyId || !id) return res.status(400).json({ error: 'Parámetros inválidos' })

    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('profe_drills')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId)
      if (error) {
        logger.error('Delete drill failed', { error: error.message })
        return res.status(500).json({ error: 'No se pudo eliminar' })
      }
      return res.status(200).json({ success: true })
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
