-- Role-aware policies: categories/coaches admin writes; players soft-delete admin; profiles guard

-- ─── profe_categories: SELECT company-wide; writes admin-only ───
DROP POLICY IF EXISTS profe_categories_all_own ON public.profe_categories;
DROP POLICY IF EXISTS profe_categories_select ON public.profe_categories;
DROP POLICY IF EXISTS profe_categories_insert ON public.profe_categories;
DROP POLICY IF EXISTS profe_categories_update ON public.profe_categories;
DROP POLICY IF EXISTS profe_categories_delete ON public.profe_categories;

CREATE POLICY profe_categories_select ON public.profe_categories
  FOR SELECT TO authenticated
  USING (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

CREATE POLICY profe_categories_insert ON public.profe_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  );

CREATE POLICY profe_categories_update ON public.profe_categories
  FOR UPDATE TO authenticated
  USING (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  )
  WITH CHECK (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  );

CREATE POLICY profe_categories_delete ON public.profe_categories
  FOR DELETE TO authenticated
  USING (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  );

-- ─── profe_coaches: SELECT company-wide; writes admin-only ───
DROP POLICY IF EXISTS profe_coaches_all_own ON public.profe_coaches;
DROP POLICY IF EXISTS profe_coaches_select ON public.profe_coaches;
DROP POLICY IF EXISTS profe_coaches_insert ON public.profe_coaches;
DROP POLICY IF EXISTS profe_coaches_update ON public.profe_coaches;
DROP POLICY IF EXISTS profe_coaches_delete ON public.profe_coaches;

CREATE POLICY profe_coaches_select ON public.profe_coaches
  FOR SELECT TO authenticated
  USING (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

CREATE POLICY profe_coaches_insert ON public.profe_coaches
  FOR INSERT TO authenticated
  WITH CHECK (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  );

CREATE POLICY profe_coaches_update ON public.profe_coaches
  FOR UPDATE TO authenticated
  USING (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  )
  WITH CHECK (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  );

CREATE POLICY profe_coaches_delete ON public.profe_coaches
  FOR DELETE TO authenticated
  USING (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  );

-- ─── profe_players: coaches create/edit active; soft-delete admin-only ───
DROP POLICY IF EXISTS profe_players_all ON public.profe_players;
DROP POLICY IF EXISTS profe_players_select ON public.profe_players;
DROP POLICY IF EXISTS profe_players_insert ON public.profe_players;
DROP POLICY IF EXISTS profe_players_update ON public.profe_players;
DROP POLICY IF EXISTS profe_players_delete ON public.profe_players;

CREATE POLICY profe_players_select ON public.profe_players
  FOR SELECT TO authenticated
  USING (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

CREATE POLICY profe_players_insert ON public.profe_players
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

CREATE POLICY profe_players_update ON public.profe_players
  FOR UPDATE TO authenticated
  USING (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  )
  WITH CHECK (
    (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
    AND (
      is_active = true
      OR private.profe_is_admin()
    )
  );

CREATE POLICY profe_players_delete ON public.profe_players
  FOR DELETE TO authenticated
  USING (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  );

-- ─── profe_profiles: self-update; admin same-company; lock privilege cols ───
DROP POLICY IF EXISTS profe_profiles_update_self ON public.profe_profiles;
DROP POLICY IF EXISTS profe_profiles_update ON public.profe_profiles;
DROP POLICY IF EXISTS profe_profiles_update_admin ON public.profe_profiles;

CREATE POLICY profe_profiles_update_self ON public.profe_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profe_profiles_update_admin ON public.profe_profiles
  FOR UPDATE TO authenticated
  USING (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  )
  WITH CHECK (
    private.profe_is_admin()
    AND (
      company_id = private.profe_current_company_id()
      OR private.profe_is_super_admin()
    )
  );

CREATE OR REPLACE FUNCTION private.profe_profiles_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / no JWT (invite API via createAdminClient)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF private.profe_is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.id = auth.uid() THEN
    NEW.role := OLD.role;
    NEW.company_id := OLD.company_id;
    NEW.is_active := OLD.is_active;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'profe_profiles update not allowed';
END;
$$;

DROP TRIGGER IF EXISTS trg_profe_profiles_guard_update ON public.profe_profiles;
CREATE TRIGGER trg_profe_profiles_guard_update
  BEFORE UPDATE ON public.profe_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.profe_profiles_guard_update();
