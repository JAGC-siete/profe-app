/** Roles que existen en profe_profiles.role CHECK + privilegio admin. */
export const ADMIN_ROLES = ['super_admin', 'company_admin'] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false
  return ADMIN_ROLES.includes(role.trim().toLowerCase() as AdminRole)
}
