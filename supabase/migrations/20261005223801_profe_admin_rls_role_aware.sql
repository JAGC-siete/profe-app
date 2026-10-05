-- Role-aware RLS helper: company_admin | super_admin

CREATE OR REPLACE FUNCTION private.profe_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profe_profiles
    WHERE id = auth.uid()
      AND lower(role) IN ('company_admin', 'super_admin')
      AND is_active = true
  )
$$;

REVOKE ALL ON FUNCTION private.profe_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.profe_is_admin() TO authenticated;
