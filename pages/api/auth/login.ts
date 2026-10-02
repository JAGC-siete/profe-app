import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient, createAdminClient } from '../../../lib/supabase/server'
import { logger } from '../../../lib/logger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase()
    const password = String(req.body?.password ?? '').replace(
      /[\u0009\u000A\u000D\u00A0\u200B\u200C\u200D\uFEFF]/g,
      ''
    )

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' })
    }

    const supabase = createClient(req, res)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    await new Promise((r) => setTimeout(r, 50))

    if (authError || !authData.user) {
      logger.warn('Login failed', { email, error: authError?.message })
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profe_profiles')
      .select('id, company_id, role, full_name, is_active')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut()
      return res.status(403).json({ success: false, error: 'Perfil inactivo o no encontrado' })
    }

    if (!profile.company_id && profile.role !== 'super_admin') {
      await supabase.auth.signOut()
      return res.status(403).json({ success: false, error: 'Sin empresa asignada' })
    }

    logger.info('Login ok', { userId: authData.user.id, companyId: profile.company_id })

    return res.status(200).json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: profile.full_name,
        role: profile.role,
        company_id: profile.company_id,
      },
      session: authData.session,
    })
  } catch (error) {
    logger.error('Login error', { error: String(error) })
    return res.status(500).json({ success: false, error: 'Error interno' })
  }
}
