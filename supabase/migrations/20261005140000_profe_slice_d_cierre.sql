-- Slice D: jugadores, asistencia, review de sesión

CREATE TABLE IF NOT EXISTS public.profe_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.profe_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profe_players_name_len CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 120)
);

CREATE INDEX IF NOT EXISTS idx_profe_players_company_category
  ON public.profe_players(company_id, category);

CREATE TABLE IF NOT EXISTS public.profe_session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.profe_companies(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.profe_training_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profe_players(id) ON DELETE CASCADE,
  present BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_profe_attendance_session
  ON public.profe_session_attendance(session_id);

CREATE TABLE IF NOT EXISTS public.profe_session_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.profe_companies(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.profe_training_sessions(id) ON DELETE CASCADE,
  intensity INT NOT NULL CHECK (intensity BETWEEN 1 AND 5),
  objective_met BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

ALTER TABLE public.profe_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profe_session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profe_session_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profe_players FROM anon, authenticated;
REVOKE ALL ON TABLE public.profe_session_attendance FROM anon, authenticated;
REVOKE ALL ON TABLE public.profe_session_reviews FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profe_players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profe_session_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profe_session_reviews TO authenticated;

DROP POLICY IF EXISTS profe_players_all ON public.profe_players;
CREATE POLICY profe_players_select ON public.profe_players
  FOR SELECT TO authenticated
  USING (company_id = private.profe_current_company_id() OR private.profe_is_super_admin());
CREATE POLICY profe_players_insert ON public.profe_players
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.profe_current_company_id());
CREATE POLICY profe_players_update ON public.profe_players
  FOR UPDATE TO authenticated
  USING (company_id = private.profe_current_company_id())
  WITH CHECK (company_id = private.profe_current_company_id());
CREATE POLICY profe_players_delete ON public.profe_players
  FOR DELETE TO authenticated
  USING (company_id = private.profe_current_company_id());

CREATE POLICY profe_attendance_select ON public.profe_session_attendance
  FOR SELECT TO authenticated
  USING (company_id = private.profe_current_company_id() OR private.profe_is_super_admin());
CREATE POLICY profe_attendance_insert ON public.profe_session_attendance
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.profe_current_company_id());
CREATE POLICY profe_attendance_update ON public.profe_session_attendance
  FOR UPDATE TO authenticated
  USING (company_id = private.profe_current_company_id())
  WITH CHECK (company_id = private.profe_current_company_id());
CREATE POLICY profe_attendance_delete ON public.profe_session_attendance
  FOR DELETE TO authenticated
  USING (company_id = private.profe_current_company_id());

CREATE POLICY profe_reviews_select ON public.profe_session_reviews
  FOR SELECT TO authenticated
  USING (company_id = private.profe_current_company_id() OR private.profe_is_super_admin());
CREATE POLICY profe_reviews_insert ON public.profe_session_reviews
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.profe_current_company_id());
CREATE POLICY profe_reviews_update ON public.profe_session_reviews
  FOR UPDATE TO authenticated
  USING (company_id = private.profe_current_company_id())
  WITH CHECK (company_id = private.profe_current_company_id());
CREATE POLICY profe_reviews_delete ON public.profe_session_reviews
  FOR DELETE TO authenticated
  USING (company_id = private.profe_current_company_id());
