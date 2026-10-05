-- Slice A: fases flexibles, minutos, materiales, plantillas/duplicar

ALTER TABLE public.profe_training_sessions
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_session_id UUID NULL
    REFERENCES public.profe_training_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profe_training_sessions_template
  ON public.profe_training_sessions(company_id, is_template);

ALTER TABLE public.profe_training_phases
  DROP CONSTRAINT IF EXISTS profe_training_phases_phase_name_check;

ALTER TABLE public.profe_training_phases
  ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 0
    CHECK (duration_minutes >= 0 AND duration_minutes <= 180),
  ADD COLUMN IF NOT EXISTS materials_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.profe_training_phases
  DROP CONSTRAINT IF EXISTS profe_training_phases_phase_name_len;
ALTER TABLE public.profe_training_phases
  ADD CONSTRAINT profe_training_phases_phase_name_len
  CHECK (char_length(trim(phase_name)) >= 1 AND char_length(phase_name) <= 80);

COMMENT ON COLUMN public.profe_training_sessions.is_template IS
  'Plantilla reutilizable (no es sesión calendarizada operativa).';
COMMENT ON COLUMN public.profe_training_phases.duration_minutes IS
  'Minutos asignados a la fase (0 = sin estimar).';
COMMENT ON COLUMN public.profe_training_phases.materials_json IS
  'Materiales estructurados [{item, qty}] para agregación de sesión.';
