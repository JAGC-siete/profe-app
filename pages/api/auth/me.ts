import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireCompanyAccess(req, res)
    if (!auth.userProfile) {
      return res.status(403).json({ error: 'User profile required' })
    }
    return res.status(200).json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        full_name: auth.userProfile.full_name,
        role: auth.role,
        company_id: auth.companyId,
        is_active: auth.userProfile.is_active,
      },
    })
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
