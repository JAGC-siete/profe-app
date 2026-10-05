-- Escena táctica JSON (Three.js) + preview sigue en diagram_image_url
-- Proyecto: sandbox cthzofskbfpcgapdauac (profe_*)

ALTER TABLE public.profe_drills
  ADD COLUMN IF NOT EXISTS diagram_scene_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profe_training_phases
  ADD COLUMN IF NOT EXISTS diagram_scene_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profe_drills.diagram_scene_json IS
  'Escena de cancha normalizada (elementos + steps de animación). Preview en diagram_image_url.';

COMMENT ON COLUMN public.profe_training_phases.diagram_scene_json IS
  'Escena de cancha normalizada (elementos + steps de animación). Preview en diagram_image_url.';
