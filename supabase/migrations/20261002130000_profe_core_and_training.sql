-- Profe App: tenant core + dominio de entrenamientos (aislado de RRHH)
-- RLS por company_id vía user_profiles

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tenant core ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Tegucigalpa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'coach',
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_company ON public.user_profiles(company_id);

-- Helper: company_id del usuario autenticado (security definer, schema privado)
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND lower(role) = 'super_admin' AND is_active = true
  )
$$;

-- ─── Dominio entrenamientos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_training_sessions_company
  ON public.training_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_category
  ON public.training_sessions(company_id, category);
CREATE INDEX IF NOT EXISTS idx_training_sessions_date
  ON public.training_sessions(company_id, scheduled_date DESC);

CREATE TABLE IF NOT EXISTS public.training_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_training_phases_session
  ON public.training_phases(session_id);

-- ─── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_phases ENABLE ROW LEVEL SECURITY;

-- companies
DROP POLICY IF EXISTS companies_select_own ON public.companies;
CREATE POLICY companies_select_own ON public.companies
  FOR SELECT TO authenticated
  USING (id = private.current_company_id() OR private.is_super_admin());

-- user_profiles
DROP POLICY IF EXISTS profiles_select_own_company ON public.user_profiles;
CREATE POLICY profiles_select_own_company ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR company_id = private.current_company_id()
    OR private.is_super_admin()
  );

DROP POLICY IF EXISTS profiles_update_self ON public.user_profiles;
CREATE POLICY profiles_update_self ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- training_sessions
DROP POLICY IF EXISTS training_sessions_select ON public.training_sessions;
CREATE POLICY training_sessions_select ON public.training_sessions
  FOR SELECT TO authenticated
  USING (company_id = private.current_company_id() OR private.is_super_admin());

DROP POLICY IF EXISTS training_sessions_insert ON public.training_sessions;
CREATE POLICY training_sessions_insert ON public.training_sessions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());

DROP POLICY IF EXISTS training_sessions_update ON public.training_sessions;
CREATE POLICY training_sessions_update ON public.training_sessions
  FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());

DROP POLICY IF EXISTS training_sessions_delete ON public.training_sessions;
CREATE POLICY training_sessions_delete ON public.training_sessions
  FOR DELETE TO authenticated
  USING (company_id = private.current_company_id());

-- training_phases
DROP POLICY IF EXISTS training_phases_select ON public.training_phases;
CREATE POLICY training_phases_select ON public.training_phases
  FOR SELECT TO authenticated
  USING (company_id = private.current_company_id() OR private.is_super_admin());

DROP POLICY IF EXISTS training_phases_insert ON public.training_phases;
CREATE POLICY training_phases_insert ON public.training_phases
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());

DROP POLICY IF EXISTS training_phases_update ON public.training_phases;
CREATE POLICY training_phases_update ON public.training_phases
  FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());

DROP POLICY IF EXISTS training_phases_delete ON public.training_phases;
CREATE POLICY training_phases_delete ON public.training_phases
  FOR DELETE TO authenticated
  USING (company_id = private.current_company_id());

-- ─── Storage: diagramas de ejercicio ───────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-diagrams',
  'training-diagrams',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Path: {company_id}/{session_or_temp}/{filename}
DROP POLICY IF EXISTS training_diagrams_select ON storage.objects;
CREATE POLICY training_diagrams_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'training-diagrams'
    AND (
      private.is_super_admin()
      OR (storage.foldername(name))[1] = private.current_company_id()::text
    )
  );

DROP POLICY IF EXISTS training_diagrams_public_read ON storage.objects;
CREATE POLICY training_diagrams_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'training-diagrams');

DROP POLICY IF EXISTS training_diagrams_insert ON storage.objects;
CREATE POLICY training_diagrams_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'training-diagrams'
    AND (storage.foldername(name))[1] = private.current_company_id()::text
  );

DROP POLICY IF EXISTS training_diagrams_update ON storage.objects;
CREATE POLICY training_diagrams_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'training-diagrams'
    AND (storage.foldername(name))[1] = private.current_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'training-diagrams'
    AND (storage.foldername(name))[1] = private.current_company_id()::text
  );

DROP POLICY IF EXISTS training_diagrams_delete ON storage.objects;
CREATE POLICY training_diagrams_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'training-diagrams'
    AND (storage.foldername(name))[1] = private.current_company_id()::text
  );

COMMENT ON TABLE public.training_sessions IS 'Cabecera de hoja de entrenamiento (SaaS por company_id)';
COMMENT ON TABLE public.training_phases IS 'Fases: Orientación, Aprendizaje, Aplicación, Juego';
