-- Profe App (sandbox cthzofskbfpcgapdauac)
-- Aislado de mercado_* y webycitas (leads/sites/appointments).
-- NO toca public.user_profiles (roles mercado: super_admin/owner).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS private;

-- ─── Tenant Profe ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profe_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Tegucigalpa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profe_companies IS
  'Tenants Profe App. Aislado de mercado/webycitas.';

CREATE TABLE IF NOT EXISTS public.profe_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.profe_companies(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'coach'
    CHECK (role IN ('super_admin', 'company_admin', 'coach')),
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profe_profiles_company
  ON public.profe_profiles(company_id);

COMMENT ON TABLE public.profe_profiles IS
  'Perfiles Profe App. Separado de public.user_profiles (mercado/webycitas).';

-- Helpers Profe (no colisionan con helpers de otras apps)
CREATE OR REPLACE FUNCTION private.profe_current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profe_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.profe_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profe_profiles
    WHERE id = auth.uid()
      AND lower(role) = 'super_admin'
      AND is_active = true
  )
$$;

REVOKE ALL ON FUNCTION private.profe_current_company_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.profe_is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.profe_current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.profe_is_super_admin() TO authenticated;

-- ─── Dominio entrenamientos ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profe_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.profe_companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  coach_name TEXT NOT NULL,
  category TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  general_objective TEXT NOT NULL DEFAULT '',
  physical_objective TEXT NOT NULL DEFAULT '',
  devotional_theme TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profe_training_sessions_company
  ON public.profe_training_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_profe_training_sessions_category
  ON public.profe_training_sessions(company_id, category);
CREATE INDEX IF NOT EXISTS idx_profe_training_sessions_date
  ON public.profe_training_sessions(company_id, scheduled_date DESC);

COMMENT ON TABLE public.profe_training_sessions IS
  'Cabecera hoja de entrenamiento Profe. RLS por profe company_id.';

CREATE TABLE IF NOT EXISTS public.profe_training_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.profe_training_sessions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.profe_companies(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL CHECK (
    phase_name IN ('Orientación', 'Aprendizaje', 'Aplicación', 'Juego')
  ),
  explanation TEXT NOT NULL DEFAULT '',
  variants_materials TEXT NOT NULL DEFAULT '',
  diagram_image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profe_training_phases_session
  ON public.profe_training_phases(session_id);

COMMENT ON TABLE public.profe_training_phases IS
  'Fases Profe: Orientación, Aprendizaje, Aplicación, Juego.';

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.profe_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profe_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profe_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profe_training_phases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profe_companies FROM anon, authenticated;
REVOKE ALL ON TABLE public.profe_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.profe_training_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.profe_training_phases FROM anon, authenticated;

GRANT SELECT ON TABLE public.profe_companies TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.profe_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profe_training_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profe_training_phases TO authenticated;

DROP POLICY IF EXISTS profe_companies_select_own ON public.profe_companies;
CREATE POLICY profe_companies_select_own ON public.profe_companies
  FOR SELECT TO authenticated
  USING (
    id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

DROP POLICY IF EXISTS profe_profiles_select_own ON public.profe_profiles;
CREATE POLICY profe_profiles_select_own ON public.profe_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

DROP POLICY IF EXISTS profe_profiles_update_self ON public.profe_profiles;
CREATE POLICY profe_profiles_update_self ON public.profe_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profe_sessions_select ON public.profe_training_sessions;
CREATE POLICY profe_sessions_select ON public.profe_training_sessions
  FOR SELECT TO authenticated
  USING (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

DROP POLICY IF EXISTS profe_sessions_insert ON public.profe_training_sessions;
CREATE POLICY profe_sessions_insert ON public.profe_training_sessions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.profe_current_company_id());

DROP POLICY IF EXISTS profe_sessions_update ON public.profe_training_sessions;
CREATE POLICY profe_sessions_update ON public.profe_training_sessions
  FOR UPDATE TO authenticated
  USING (company_id = private.profe_current_company_id())
  WITH CHECK (company_id = private.profe_current_company_id());

DROP POLICY IF EXISTS profe_sessions_delete ON public.profe_training_sessions;
CREATE POLICY profe_sessions_delete ON public.profe_training_sessions
  FOR DELETE TO authenticated
  USING (company_id = private.profe_current_company_id());

DROP POLICY IF EXISTS profe_phases_select ON public.profe_training_phases;
CREATE POLICY profe_phases_select ON public.profe_training_phases
  FOR SELECT TO authenticated
  USING (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

DROP POLICY IF EXISTS profe_phases_insert ON public.profe_training_phases;
CREATE POLICY profe_phases_insert ON public.profe_training_phases
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.profe_current_company_id());

DROP POLICY IF EXISTS profe_phases_update ON public.profe_training_phases;
CREATE POLICY profe_phases_update ON public.profe_training_phases
  FOR UPDATE TO authenticated
  USING (company_id = private.profe_current_company_id())
  WITH CHECK (company_id = private.profe_current_company_id());

DROP POLICY IF EXISTS profe_phases_delete ON public.profe_training_phases;
CREATE POLICY profe_phases_delete ON public.profe_training_phases
  FOR DELETE TO authenticated
  USING (company_id = private.profe_current_company_id());

-- ─── Storage: solo bucket profe ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profe-training-diagrams',
  'profe-training-diagrams',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS profe_diagrams_public_read ON storage.objects;
CREATE POLICY profe_diagrams_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'profe-training-diagrams');

DROP POLICY IF EXISTS profe_diagrams_insert ON storage.objects;
CREATE POLICY profe_diagrams_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profe-training-diagrams'
    AND (storage.foldername(name))[1] = private.profe_current_company_id()::text
  );

DROP POLICY IF EXISTS profe_diagrams_update ON storage.objects;
CREATE POLICY profe_diagrams_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profe-training-diagrams'
    AND (storage.foldername(name))[1] = private.profe_current_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'profe-training-diagrams'
    AND (storage.foldername(name))[1] = private.profe_current_company_id()::text
  );

DROP POLICY IF EXISTS profe_diagrams_delete ON storage.objects;
CREATE POLICY profe_diagrams_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profe-training-diagrams'
    AND (storage.foldername(name))[1] = private.profe_current_company_id()::text
  );
