import { NextApiRequest, NextApiResponse } from 'next'
import { createClient, createAdminClient } from '../supabase/server'

export interface AuthenticatedUser {
  supabase: ReturnType<typeof createClient>
  user: { id: string; email?: string }
  userProfile: {
    id: string
    company_id: string | null
    role: string
    is_active: boolean
    full_name?: string | null
  } | null
  companyId: string | null
  companyTimezone: string | null
  role: string
}

export interface AuthOptions {
  requireProfile?: boolean
  requireAdmin?: boolean
  allowedRoles?: string[]
  allowSuperAdminWithoutCompany?: boolean
}

/**
 * Auth estandarizada para API — patrón saas-proyecto (api-auth-fixed).
 */
export async function authenticateUser(
  req: NextApiRequest,
  res: NextApiResponse,
  options: AuthOptions = {}
): Promise<AuthenticatedUser> {
  const {
    requireProfile = true,
    requireAdmin = false,
    allowedRoles = [],
  } = options

  try {
    const supabase = createClient(req, res)

    const authHeader = req.headers.authorization
    const bearer =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null

    let {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if ((!user || authError) && bearer) {
      const bearerResult = await supabase.auth.getUser(bearer)
      if (bearerResult.data.user) {
        user = bearerResult.data.user
        authError = bearerResult.error
      }
    }

    if (authError || !user) {
      if (!res.headersSent) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Sesión inválida o expirada. Vuelve a iniciar sesión.',
        })
      }
      throw new Error('UNAUTHORIZED')
    }

    const adminSupabase = createAdminClient()
    const { data: userProfile, error: profileError } = await adminSupabase
      .from('profe_profiles')
      .select('id, company_id, role, is_active, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      if (requireProfile) {
        if (!res.headersSent) {
          res.status(403).json({ error: 'User profile required' })
        }
        throw new Error('PROFILE_REQUIRED')
      }
      return {
        supabase,
        user,
        userProfile: null,
        companyId: null,
        companyTimezone: null,
        role: 'coach',
      }
    }

    if (!userProfile) {
      if (requireProfile) {
        if (!res.headersSent) {
          res.status(403).json({ error: 'User profile not found' })
        }
        throw new Error('PROFILE_REQUIRED')
      }
      return {
        supabase,
        user,
        userProfile: null,
        companyId: null,
        companyTimezone: null,
        role: 'coach',
      }
    }

    if (!userProfile.is_active) {
      if (!res.headersSent) {
        res.status(403).json({ error: 'Account deactivated' })
      }
      throw new Error('ACCOUNT_DEACTIVATED')
    }

    const normalizedRole = (userProfile.role || '').trim().toLowerCase()

    if (
      requireAdmin &&
      !['super_admin', 'company_admin'].includes(normalizedRole)
    ) {
      if (!res.headersSent) {
        res.status(403).json({ error: 'Admin privileges required' })
      }
      throw new Error('ADMIN_REQUIRED')
    }

    if (
      allowedRoles.length > 0 &&
      !allowedRoles.map((r) => r.trim().toLowerCase()).includes(normalizedRole)
    ) {
      if (!res.headersSent) {
        res.status(403).json({ error: 'Insufficient permissions' })
      }
      throw new Error('INSUFFICIENT_PERMISSIONS')
    }

    let companyTimezone: string | null = null
    if (userProfile.company_id) {
      const { data: co } = await adminSupabase
        .from('profe_companies')
        .select('timezone')
        .eq('id', userProfile.company_id)
        .maybeSingle()
      const tzRaw = co?.timezone
      companyTimezone =
        typeof tzRaw === 'string' && tzRaw.trim().length > 0
          ? tzRaw.trim()
          : 'America/Tegucigalpa'
    }

    return {
      supabase,
      user,
      userProfile,
      companyId: userProfile.company_id,
      companyTimezone,
      role: normalizedRole,
    }
  } catch (error) {
    console.error('Authentication error:', error)
    throw error
  }
}

export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedUser> {
  return authenticateUser(req, res, { requireAdmin: true })
}

export async function requireRoles(
  req: NextApiRequest,
  res: NextApiResponse,
  roles: string[]
): Promise<AuthenticatedUser> {
  return authenticateUser(req, res, { allowedRoles: roles })
}

/** Company-scoped endpoints — permite super_admin sin company_id. */
export async function requireCompanyAccess(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedUser> {
  const auth = await authenticateUser(req, res, { requireProfile: true })

  if (!auth.companyId && auth.role !== 'super_admin') {
    if (!res.headersSent) {
      res.status(400).json({ error: 'Company access required' })
    }
    throw new Error('COMPANY_ACCESS_REQUIRED')
  }

  return auth
}

export async function requireSuperAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedUser> {
  return authenticateUser(req, res, { allowedRoles: ['super_admin'] })
}
