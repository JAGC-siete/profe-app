import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../lib/auth/api-auth-fixed'
import { createAdminClient } from '../../../lib/supabase/server'
import { inviteCoachSchema, profileStatusSchema } from '../../../lib/validations/admin'
import { logger } from '../../../lib/logger'

type AdminClient = ReturnType<typeof createAdminClient>

type AuthLookup =
  | { status: 'not_found' }
  | { status: 'lookup_exhausted' }
  | {
      status: 'found'
      userId: string
      profile: {
        id: string
        role: string
        company_id: string | null
        full_name: string | null
      } | null
    }

const ADMIN_PROFILE_ROLES = ['super_admin', 'company_admin']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireAdmin(req, res)
    const { companyId, role, user } = auth
    if (!companyId) return res.status(400).json({ error: 'Company required' })

    const admin = createAdminClient()

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('profe_profiles')
        .select('id, full_name, role, is_active, company_id, created_at')
        .eq('company_id', companyId)
        .order('full_name')

      if (error) {
        logger.error('List profiles failed', { error: error.message })
        return res.status(500).json({ error: 'No se pudieron listar usuarios' })
      }
      return res.status(200).json({ profiles: data ?? [] })
    }

    if (req.method === 'POST') {
      if (!ADMIN_PROFILE_ROLES.includes(role)) {
        return res.status(403).json({ error: 'Solo dueño de academia puede invitar' })
      }

      const parsed = inviteCoachSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validación fallida',
          details: parsed.error.flatten(),
        })
      }

      const email = parsed.data.email.trim().toLowerCase()
      const fullName = parsed.data.full_name.trim()
      const category = parsed.data.category?.trim()

      const lookup = await lookupAuthByEmail(admin, email)

      if (lookup.status === 'lookup_exhausted') {
        return res.status(503).json({
          error:
            'No se pudo verificar si el email ya existe en Auth. Intenta de nuevo o contacta soporte.',
        })
      }

      if (lookup.status === 'found') {
        const existingProfile = lookup.profile

        if (existingProfile) {
          if (
            existingProfile.company_id &&
            existingProfile.company_id !== companyId
          ) {
            return res.status(409).json({
              error: 'Ese email ya pertenece a otra academia',
            })
          }
          if (ADMIN_PROFILE_ROLES.includes(existingProfile.role)) {
            return res.status(409).json({
              error: 'Ese usuario ya es administrador; no se puede reasignar como coach',
            })
          }

          const { data: profile, error: updError } = await admin
            .from('profe_profiles')
            .update({
              company_id: companyId,
              full_name: fullName,
              is_active: true,
              role: 'coach',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingProfile.id)
            .eq('role', 'coach')
            .select('id, full_name, role, is_active, company_id, created_at')
            .maybeSingle()

          if (updError || !profile) {
            logger.error('Reactivate profile failed', { error: updError?.message })
            return res.status(409).json({
              error: 'No se pudo vincular el perfil (conflicto de rol o academia)',
            })
          }

          await ensureCoachRoster(admin, companyId, fullName, category)
          return res.status(200).json({
            profile,
            invited: false,
            message: 'Usuario existente vinculado / reactivado',
          })
        }

        // Auth user exists without profe_profiles — dedicated insert path
        const { data: profile, error: insertError } = await admin
          .from('profe_profiles')
          .insert({
            id: lookup.userId,
            company_id: companyId,
            role: 'coach',
            full_name: fullName,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .select('id, full_name, role, is_active, company_id, created_at')
          .single()

        if (insertError || !profile) {
          logger.error('Attach orphan Auth user failed', {
            error: insertError?.message,
          })
          return res.status(409).json({
            error: 'Ese email ya tiene cuenta Auth; no se pudo crear el perfil Profe',
          })
        }

        await ensureCoachRoster(admin, companyId, fullName, category)
        return res.status(200).json({
          profile,
          invited: false,
          message: 'Cuenta Auth existente vinculada a la academia',
        })
      }

      // No Auth user found — send invite
      const { data: invited, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName },
        })

      if (inviteError || !invited.user) {
        logger.error('Invite failed', { error: inviteError?.message, email })
        return res.status(400).json({
          error:
            inviteError?.message ||
            'No se pudo enviar la invitación. Verifica email y config Auth.',
        })
      }

      // Post-invite guard: refuse overwrite of admin / other-company profiles
      const { data: existingAfterInvite } = await admin
        .from('profe_profiles')
        .select('id, role, company_id, full_name')
        .eq('id', invited.user.id)
        .maybeSingle()

      if (existingAfterInvite) {
        if (
          existingAfterInvite.company_id &&
          existingAfterInvite.company_id !== companyId
        ) {
          return res.status(409).json({
            error: 'Invitación enviada pero el usuario pertenece a otra academia',
          })
        }
        if (ADMIN_PROFILE_ROLES.includes(existingAfterInvite.role)) {
          return res.status(409).json({
            error: 'Invitación enviada pero el usuario es administrador; no se reasigna',
          })
        }

        const { data: profile, error: updError } = await admin
          .from('profe_profiles')
          .update({
            company_id: companyId,
            full_name: fullName,
            is_active: true,
            role: 'coach',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAfterInvite.id)
          .eq('role', 'coach')
          .select('id, full_name, role, is_active, company_id, created_at')
          .maybeSingle()

        if (updError || !profile) {
          logger.error('Post-invite profile update failed', {
            error: updError?.message,
          })
          return res.status(500).json({
            error: 'Invitación enviada pero falló actualizar el perfil Profe',
          })
        }

        await ensureCoachRoster(admin, companyId, fullName, category)
        return res.status(201).json({
          profile,
          invited: true,
          message: 'Invitación enviada',
        })
      }

      const { data: profile, error: profileError } = await admin
        .from('profe_profiles')
        .insert({
          id: invited.user.id,
          company_id: companyId,
          role: 'coach',
          full_name: fullName,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select('id, full_name, role, is_active, company_id, created_at')
        .single()

      if (profileError || !profile) {
        logger.error('Create profile after invite failed', {
          error: profileError?.message,
        })
        return res.status(500).json({
          error: 'Invitación enviada pero falló crear el perfil Profe',
        })
      }

      await ensureCoachRoster(admin, companyId, fullName, category)
      return res.status(201).json({
        profile,
        invited: true,
        message: 'Invitación enviada',
      })
    }

    if (req.method === 'PATCH') {
      if (!ADMIN_PROFILE_ROLES.includes(role)) {
        return res.status(403).json({ error: 'Solo dueño de academia puede cambiar estado' })
      }

      const profileId = typeof req.body?.id === 'string' ? req.body.id : ''
      if (!profileId) return res.status(400).json({ error: 'ID requerido' })
      if (profileId === user.id) {
        return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' })
      }

      const parsed = profileStatusSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validación fallida',
          details: parsed.error.flatten(),
        })
      }

      const { data: target, error: targetError } = await admin
        .from('profe_profiles')
        .select('id, role, company_id')
        .eq('id', profileId)
        .eq('company_id', companyId)
        .maybeSingle()

      if (targetError || !target) {
        return res.status(404).json({ error: 'Usuario no encontrado' })
      }
      if (target.role === 'super_admin' && role !== 'super_admin') {
        return res.status(403).json({ error: 'No puedes modificar un super_admin' })
      }
      if (target.role === 'company_admin' && role !== 'super_admin') {
        return res.status(403).json({ error: 'No puedes desactivar a otro company_admin' })
      }

      const { data, error } = await admin
        .from('profe_profiles')
        .update({
          is_active: parsed.data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
        .eq('company_id', companyId)
        .select('id, full_name, role, is_active, company_id, created_at')
        .maybeSingle()

      if (error || !data) {
        logger.error('Update profile status failed', { error: error?.message })
        return res.status(500).json({ error: 'No se pudo actualizar' })
      }
      return res.status(200).json({ profile: data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'ADMIN_REQUIRED', 'ACCOUNT_DEACTIVATED'].includes(
        error.message
      )
    ) {
      return
    }
    logger.error('admin profiles error', { error: String(error) })
    if (!res.headersSent) return res.status(500).json({ error: 'Error interno' })
  }
}

async function lookupAuthByEmail(
  admin: AdminClient,
  email: string
): Promise<AuthLookup> {
  const authAdmin = admin.auth.admin as typeof admin.auth.admin & {
    getUserByEmail?: (email: string) => Promise<{
      data: { user: { id: string } | null }
      error: { message: string } | null
    }>
  }

  if (typeof authAdmin.getUserByEmail === 'function') {
    const { data, error } = await authAdmin.getUserByEmail(email)
    if (!error && data?.user?.id) {
      const { data: profile } = await admin
        .from('profe_profiles')
        .select('id, role, company_id, full_name')
        .eq('id', data.user.id)
        .maybeSingle()
      return { status: 'found', userId: data.user.id, profile: profile ?? null }
    }
    // getUserByEmail available and no match → treat as not found
    if (!error || /not\s*found|user.*not.*found/i.test(error.message || '')) {
      return { status: 'not_found' }
    }
    logger.warn('getUserByEmail failed, falling back to listUsers', {
      error: error.message,
    })
  }

  // Fallback: paginate Auth users (bounded) — fail closed if exhausted
  const maxPages = 10
  for (let page = 1; page <= maxPages; page += 1) {
    const { data: listed, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) {
      logger.error('listUsers failed during invite lookup', { error: error.message })
      return { status: 'lookup_exhausted' }
    }
    const match = listed?.users?.find((u) => (u.email || '').toLowerCase() === email)
    if (match) {
      const { data: profile } = await admin
        .from('profe_profiles')
        .select('id, role, company_id, full_name')
        .eq('id', match.id)
        .maybeSingle()
      return { status: 'found', userId: match.id, profile: profile ?? null }
    }
    if (!listed?.users?.length || listed.users.length < 200) {
      return { status: 'not_found' }
    }
  }

  // Hit page cap without match — cannot safely assume new user
  return { status: 'lookup_exhausted' }
}

async function ensureCoachRoster(
  admin: AdminClient,
  companyId: string,
  fullName: string,
  category?: string
) {
  if (!category) return
  const { error } = await admin.from('profe_coaches').upsert(
    {
      company_id: companyId,
      full_name: fullName,
      category,
      notes: '',
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,full_name,category' }
  )
  if (error) {
    logger.warn('ensureCoachRoster failed', { error: error.message })
  }
}
