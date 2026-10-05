-- Slice B: biblioteca de ejercicios (profe_drills)

CREATE TABLE IF NOT EXISTS public.profe_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.profe_companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  variants_materials TEXT NOT NULL DEFAULT '',
  materials_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  diagram_image_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profe_drills_name_len CHECK (char_length(trim(name)) >= 2 AND char_length(name) <= 120)
);

CREATE INDEX IF NOT EXISTS idx_profe_drills_company
  ON public.profe_drills(company_id);
CREATE INDEX IF NOT EXISTS idx_profe_drills_name
  ON public.profe_drills(company_id, name);

COMMENT ON TABLE public.profe_drills IS
  'Banco de ejercicios Profe. Aislado de mercado/webycitas.';

ALTER TABLE public.profe_drills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profe_drills FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profe_drills TO authenticated;

DROP POLICY IF EXISTS profe_drills_select ON public.profe_drills;
CREATE POLICY profe_drills_select ON public.profe_drills
  FOR SELECT TO authenticated
  USING (company_id = private.profe_current_company_id() OR private.profe_is_super_admin());

DROP POLICY IF EXISTS profe_drills_insert ON public.profe_drills;
CREATE POLICY profe_drills_insert ON public.profe_drills
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.profe_current_company_id());

DROP POLICY IF EXISTS profe_drills_update ON public.profe_drills;
CREATE POLICY profe_drills_update ON public.profe_drills
  FOR UPDATE TO authenticated
  USING (company_id = private.profe_current_company_id())
  WITH CHECK (company_id = private.profe_current_company_id());

DROP POLICY IF EXISTS profe_drills_delete ON public.profe_drills;
CREATE POLICY profe_drills_delete ON public.profe_drills
  FOR DELETE TO authenticated
  USING (company_id = private.profe_current_company_id());
