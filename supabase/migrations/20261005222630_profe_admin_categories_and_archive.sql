-- Admin: categorías de academia + archive en sesiones

CREATE TABLE IF NOT EXISTS public.profe_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.profe_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 80),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_profe_categories_company
  ON public.profe_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_profe_categories_company_active
  ON public.profe_categories(company_id, is_active, sort_order);

COMMENT ON TABLE public.profe_categories IS
  'Categorías de academia (alta/baja desde admin).';

ALTER TABLE public.profe_categories ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profe_categories FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profe_categories TO authenticated;

DROP POLICY IF EXISTS profe_categories_all_own ON public.profe_categories;
CREATE POLICY profe_categories_all_own ON public.profe_categories
  FOR ALL TO authenticated
  USING (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  )
  WITH CHECK (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

ALTER TABLE public.profe_training_sessions
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profe_sessions_company_archived
  ON public.profe_training_sessions(company_id, is_archived);

COMMENT ON COLUMN public.profe_training_sessions.is_archived IS
  'Archivado desde admin (baja suave de sesión).';

-- Seed categorías desde strings existentes + defaults por compañía
INSERT INTO public.profe_categories (company_id, name, sort_order, is_active)
SELECT
  c.id AS company_id,
  cat.name,
  cat.sort_order,
  true
FROM public.profe_companies c
CROSS JOIN (
  VALUES
    ('U7', 10),
    ('U9', 20),
    ('U13', 30),
    ('U15', 40),
    ('Mayor', 50)
) AS cat(name, sort_order)
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO public.profe_categories (company_id, name, sort_order, is_active)
SELECT DISTINCT
  src.company_id,
  trim(src.category) AS name,
  100 AS sort_order,
  true
FROM (
  SELECT company_id, category FROM public.profe_coaches WHERE category IS NOT NULL AND trim(category) <> ''
  UNION
  SELECT company_id, category FROM public.profe_players WHERE category IS NOT NULL AND trim(category) <> ''
  UNION
  SELECT company_id, category FROM public.profe_training_sessions WHERE category IS NOT NULL AND trim(category) <> ''
) src
WHERE src.company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;
