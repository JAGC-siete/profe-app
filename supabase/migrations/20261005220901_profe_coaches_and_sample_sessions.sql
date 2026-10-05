-- Listado de profes + sesiones ejemplo por categoría

CREATE TABLE IF NOT EXISTS public.profe_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.profe_companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2 AND char_length(full_name) <= 120),
  category TEXT NOT NULL CHECK (char_length(trim(category)) >= 1 AND char_length(category) <= 80),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, full_name, category)
);

CREATE INDEX IF NOT EXISTS idx_profe_coaches_company
  ON public.profe_coaches(company_id);
CREATE INDEX IF NOT EXISTS idx_profe_coaches_category
  ON public.profe_coaches(company_id, category);

COMMENT ON TABLE public.profe_coaches IS
  'Listado de entrenadores por categoría (Profe App).';

ALTER TABLE public.profe_coaches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profe_coaches FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profe_coaches TO authenticated;

DROP POLICY IF EXISTS profe_coaches_all_own ON public.profe_coaches;
CREATE POLICY profe_coaches_all_own ON public.profe_coaches
  FOR ALL TO authenticated
  USING (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  )
  WITH CHECK (
    company_id = private.profe_current_company_id()
    OR private.profe_is_super_admin()
  );

-- Seed profes + 3 sesiones por categoría (solo si la compañía demo existe y aún no hay seed)
DO $$
DECLARE
  cid UUID;
  sid UUID;
BEGIN
  SELECT id INTO cid
  FROM public.profe_companies
  WHERE name ILIKE '%Hope%'
  ORDER BY created_at
  LIMIT 1;

  IF cid IS NULL THEN
    SELECT id INTO cid FROM public.profe_companies ORDER BY created_at LIMIT 1;
  END IF;

  IF cid IS NULL THEN
    RAISE NOTICE 'profe_coaches seed skipped: no company';
    RETURN;
  END IF;

  -- Idempotente: no duplicar seed de ejemplo
  IF EXISTS (
    SELECT 1 FROM public.profe_training_sessions
    WHERE company_id = cid AND general_objective LIKE '[ejemplo]%'
  ) THEN
    RAISE NOTICE 'sample sessions already present, skipping seed';
    RETURN;
  END IF;

  INSERT INTO public.profe_coaches (company_id, full_name, category, notes)
  VALUES
    (cid, 'Gustavo Lemus', 'U7', 'Categoría infantil U7'),
    (cid, 'Allan Castro', 'U9', 'Categoría infantil U9'),
    (cid, 'Marcelo', 'U13', 'Categoría prejuvenil U13'),
    (cid, 'Abiezer', 'U15', 'Categoría juvenil U15'),
    (cid, 'Cesar Vasquez', 'Mayor', 'Categoría mayor / adultos')
  ON CONFLICT (company_id, full_name, category) DO NOTHING;

  -- ── U7 · Gustavo Lemus ─────────────────────────────────────
  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Gustavo Lemus', 'U7', CURRENT_DATE,
    '[ejemplo] Divertirse con el balón: conducción y paradas',
    'Activación lúdica, coordinación gruesa',
    'Jugar con alegría',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Juego de persecución suave con balón en la mano y luego en el pie. Regla: nadie puede empujar.',
     E'8 conos\n8 balones\nPetos',
     '[{"item":"conos","qty":8},{"item":"balones","qty":8},{"item":"petos","qty":8}]'::jsonb, 10, 0),
    (sid, cid, 'Aprendizaje',
     'Conducción en zigzag entre 6 conos. Pie dominante, luego pie débil. Premio: chocar cinco con la mano del profe.',
     E'12 conos\n8 balones',
     '[{"item":"conos","qty":12},{"item":"balones","qty":8}]'::jsonb, 15, 1),
    (sid, cid, 'Aplicación',
     '1v1 a mini portería en canal corto. Atacante busca tocar el balón en la portería; defensor solo intercepta sin tackle fuerte.',
     E'4 mini porterías\n8 conos\n4 balones',
     '[{"item":"mini porterías","qty":4},{"item":"conos","qty":8},{"item":"balones","qty":4}]'::jsonb, 15, 2),
    (sid, cid, 'Juego',
     '3v3 en cancha reducida con 2 porterías. Saque rápido. Todos atacan y defienden.',
     E'2 porterías\n8 conos\n1 balón\n6 petos',
     '[{"item":"porterías","qty":2},{"item":"conos","qty":8},{"item":"balón","qty":1},{"item":"petos","qty":6}]'::jsonb, 20, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Gustavo Lemus', 'U7', CURRENT_DATE + 2,
    '[ejemplo] Pase corto y recibir con la planta',
    'Equilibrio y cambios de dirección',
    'Ayudar al compañero',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Círculo: pase al compañero y cambiar de lugar. Balón siempre rodando.',
     E'1 balón\n8 conos',
     '[{"item":"balón","qty":1},{"item":"conos","qty":8}]'::jsonb, 10, 0),
    (sid, cid, 'Aprendizaje',
     'Parejas: pase y apoyo a 5 m. Contar 10 pases buenos por pareja.',
     E'8 balones\n16 conos',
     '[{"item":"balones","qty":8},{"item":"conos","qty":16}]'::jsonb, 15, 1),
    (sid, cid, 'Aplicación',
     'Triángulos de pase A→B→C con movimiento después del pase.',
     E'12 conos\n4 balones',
     '[{"item":"conos","qty":12},{"item":"balones","qty":4}]'::jsonb, 15, 2),
    (sid, cid, 'Juego',
     '4v4 a dos porterías. Gol solo con pase previo (no se puede marcar solo).',
     E'2 porterías\n8 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":8},{"item":"balón","qty":1}]'::jsonb, 20, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Gustavo Lemus', 'U7', CURRENT_DATE + 4,
    '[ejemplo] Orientación corporal y primer toque',
    'Agilidad en espacios cortos',
    'Escuchar instrucciones',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Cazar colores: profe grita color de cono y corren a él con balón.',
     E'16 conos\n8 balones',
     '[{"item":"conos","qty":16},{"item":"balones","qty":8}]'::jsonb, 10, 0),
    (sid, cid, 'Aprendizaje',
     'Recibir de frente y girar 90° hacia un cono libre. Sin tocar el cono.',
     E'12 conos\n8 balones',
     '[{"item":"conos","qty":12},{"item":"balones","qty":8}]'::jsonb, 15, 1),
    (sid, cid, 'Aplicación',
     'Rondo 4v1 en cuadrado pequeño. Poseedores máximo 2 toques.',
     E'8 conos\n1 balón\n4 petos',
     '[{"item":"conos","qty":8},{"item":"balón","qty":1},{"item":"petos","qty":4}]'::jsonb, 15, 2),
    (sid, cid, 'Juego',
     'Partido 4v4 con zona segura (nadie puede entrar a robar ahí 3 s).',
     E'12 conos\n2 porterías\n1 balón',
     '[{"item":"conos","qty":12},{"item":"porterías","qty":2},{"item":"balón","qty":1}]'::jsonb, 20, 3);

  -- ── U9 · Allan Castro ──────────────────────────────────────
  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Allan Castro', 'U9', CURRENT_DATE,
    '[ejemplo] Conducción con cambio de ritmo y dirección',
    'Aceleración corta y frenada',
    'Esfuerzo honesto',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Conducción libre en mitad de cancha; al silbato cambian de dirección 180°.',
     E'10 balones\n12 conos',
     '[{"item":"balones","qty":10},{"item":"conos","qty":12}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     'Zigzag de 6 conos + sprint final a mini portería. Ambos pies.',
     E'18 conos\n10 balones\n4 mini porterías',
     '[{"item":"conos","qty":18},{"item":"balones","qty":10},{"item":"mini porterías","qty":4}]'::jsonb, 18, 1),
    (sid, cid, 'Aplicación',
     '1v1 desde el centro del canal 12x8. Gol solo en mini portería.',
     E'8 conos\n4 balones\n4 mini porterías',
     '[{"item":"conos","qty":8},{"item":"balones","qty":4},{"item":"mini porterías","qty":4}]'::jsonb, 15, 2),
    (sid, cid, 'Juego',
     '5v5 cancha reducida. Transición: si pierdes el balón, presión inmediata 3 s.',
     E'2 porterías\n10 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":10},{"item":"balón","qty":1}]'::jsonb, 20, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Allan Castro', 'U9', CURRENT_DATE + 2,
    '[ejemplo] Pase y apoyo: crear líneas de pase',
    'Resistencia aeróbica liviana',
    'Trabajo en equipo',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Rondo 5v2. Si recuperas, sales al centro.',
     E'8 conos\n1 balón\n5 petos',
     '[{"item":"conos","qty":8},{"item":"balón","qty":1},{"item":"petos","qty":5}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     'Paredes en triángulo 8 m. Progresión 2 toques → 1 toque.',
     E'12 conos\n4 balones',
     '[{"item":"conos","qty":12},{"item":"balones","qty":4}]'::jsonb, 15, 1),
    (sid, cid, 'Aplicación',
     '4v2 a conservar. Objetivo: 8 pases seguidos = punto.',
     E'12 conos\n1 balón\n6 petos',
     '[{"item":"conos","qty":12},{"item":"balón","qty":1},{"item":"petos","qty":6}]'::jsonb, 15, 2),
    (sid, cid, 'Juego',
     '6v6. Gol vale doble si viene de pared.',
     E'2 porterías\n12 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":12},{"item":"balón","qty":1}]'::jsonb, 22, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Allan Castro', 'U9', CURRENT_DATE + 4,
    '[ejemplo] Defensa 1v1: cuerpo entre balón y portería',
    'Fuerza relativa / estabilidad',
    'Respeto al rival',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Mirror run: defensor copia pasos del atacante sin balón, luego con balón.',
     E'8 conos\n8 balones',
     '[{"item":"conos","qty":8},{"item":"balones","qty":8}]'::jsonb, 10, 0),
    (sid, cid, 'Aprendizaje',
     'Delay: defensor cede 2 m y fuerza hacia la línea. Sin tackle desde atrás.',
     E'12 conos\n6 balones',
     '[{"item":"conos","qty":12},{"item":"balones","qty":6}]'::jsonb, 15, 1),
    (sid, cid, 'Aplicación',
     '2v2 a mini porterías. Si recuperas, contraataque en 5 s.',
     E'8 conos\n4 mini porterías\n2 balones',
     '[{"item":"conos","qty":8},{"item":"mini porterías","qty":4},{"item":"balones","qty":2}]'::jsonb, 18, 2),
    (sid, cid, 'Juego',
     '5v5. Regla: primer defensor siempre oculta la portería.',
     E'2 porterías\n10 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":10},{"item":"balón","qty":1}]'::jsonb, 20, 3);

  -- ── U13 · Marcelo ──────────────────────────────────────────
  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Marcelo', 'U13', CURRENT_DATE,
    '[ejemplo] Construcción desde atrás y amplitud',
    'Resistencia intermitente',
    'Comunicación clara',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Rondo 6v3 con comodín exterior. Salida siempre a banda libre.',
     E'12 conos\n1 balón\n9 petos',
     '[{"item":"conos","qty":12},{"item":"balón","qty":1},{"item":"petos","qty":9}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     'Patrón 3+2: porteros/centrales salen a laterales; lateral progresa.',
     E'16 conos\n2 balones',
     '[{"item":"conos","qty":16},{"item":"balones","qty":2}]'::jsonb, 18, 1),
    (sid, cid, 'Aplicación',
     '7v5 a progresar al tercio contrario. Si pierdes, reorganización 5 s.',
     E'20 conos\n1 balón\n12 petos',
     '[{"item":"conos","qty":20},{"item":"balón","qty":1},{"item":"petos","qty":12}]'::jsonb, 20, 2),
    (sid, cid, 'Juego',
     '8v8 mitad de cancha. Gol solo tras pase a banda.',
     E'2 porterías\n16 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":16},{"item":"balón","qty":1}]'::jsonb, 25, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Marcelo', 'U13', CURRENT_DATE + 2,
    '[ejemplo] Presión tras pérdida y cobertura',
    'Sprint cortos + recuperación',
    'Responsabilidad colectiva',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     '4v4+2 comodines. Al perder: 3 jugadores presionan, 1 cubre.',
     E'12 conos\n1 balón\n10 petos',
     '[{"item":"conos","qty":12},{"item":"balón","qty":1},{"item":"petos","qty":10}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     'Triggers de presión: pase lateral malo o recepción de espaldas.',
     E'16 conos\n2 balones',
     '[{"item":"conos","qty":16},{"item":"balones","qty":2}]'::jsonb, 18, 1),
    (sid, cid, 'Aplicación',
     '6v6 en tres zonas. Solo puedes presionar en la zona del balón.',
     E'24 conos\n1 balón\n12 petos',
     '[{"item":"conos","qty":24},{"item":"balón","qty":1},{"item":"petos","qty":12}]'::jsonb, 20, 2),
    (sid, cid, 'Juego',
     '9v9. Contador: recuperaciones en campo rival = punto extra.',
     E'2 porterías\n18 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":18},{"item":"balón","qty":1}]'::jsonb, 25, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Marcelo', 'U13', CURRENT_DATE + 4,
    '[ejemplo] Finalización desde banda y segundo palo',
    'Potencia de disparo / coordinación',
    'Paciencia en el ataque',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Circuitos de centro desde lateral a áreas (sin oposición).',
     E'12 balones\n10 conos',
     '[{"item":"balones","qty":12},{"item":"conos","qty":10}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     '2v1 en banda → centro al segundo palo. Rotación rápida.',
     E'16 conos\n8 balones\n1 portería',
     '[{"item":"conos","qty":16},{"item":"balones","qty":8},{"item":"portería","qty":1}]'::jsonb, 18, 1),
    (sid, cid, 'Aplicación',
     '4v3 + portero. Remate en 8 s o se pierde la posesión.',
     E'12 conos\n6 balones\n1 portería\n7 petos',
     '[{"item":"conos","qty":12},{"item":"balones","qty":6},{"item":"portería","qty":1},{"item":"petos","qty":7}]'::jsonb, 18, 2),
    (sid, cid, 'Juego',
     '8v8. Gol de cabeza o segundo palo vale doble.',
     E'2 porterías\n16 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":16},{"item":"balón","qty":1}]'::jsonb, 22, 3);

  -- ── U15 · Abiezer ──────────────────────────────────────────
  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Abiezer', 'U15', CURRENT_DATE,
    '[ejemplo] Ritmo de posesión: tercer hombre',
    'HIIT fútbol-específico',
    'Disciplina táctica',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Rondo 5v2+1. Tercer hombre siempre se ofrece atrás del poseedor.',
     E'10 conos\n1 balón\n8 petos',
     '[{"item":"conos","qty":10},{"item":"balón","qty":1},{"item":"petos","qty":8}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     'Posesión 6v6+2. Gol de posesión = 10 pases + pase filtrado a zona.',
     E'20 conos\n1 balón\n14 petos',
     '[{"item":"conos","qty":20},{"item":"balón","qty":1},{"item":"petos","qty":14}]'::jsonb, 20, 1),
    (sid, cid, 'Aplicación',
     '7v7 a dos porterías pequeñas interiores + porterías reales.',
     E'16 conos\n2 porterías\n4 mini porterías\n14 petos\n1 balón',
     '[{"item":"conos","qty":16},{"item":"porterías","qty":2},{"item":"mini porterías","qty":4},{"item":"petos","qty":14},{"item":"balón","qty":1}]'::jsonb, 20, 2),
    (sid, cid, 'Juego',
     '10v10. Condición: máximo 3 toques en tercio propio.',
     E'2 porterías\n20 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":20},{"item":"balón","qty":1}]'::jsonb, 25, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Abiezer', 'U15', CURRENT_DATE + 2,
    '[ejemplo] Transiciones ofensivas en 6 segundos',
    'Potencia anaeróbica',
    'Decisión bajo fatiga',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Wave races: recuperar y progresar a zona contraria en 6 s.',
     E'16 conos\n4 balones',
     '[{"item":"conos","qty":16},{"item":"balones","qty":4}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     '4v4+porteros. Al recuperar: 2 pases máximos antes de remate.',
     E'12 conos\n2 porterías\n8 petos\n2 balones',
     '[{"item":"conos","qty":12},{"item":"porterías","qty":2},{"item":"petos","qty":8},{"item":"balones","qty":2}]'::jsonb, 18, 1),
    (sid, cid, 'Aplicación',
     '8v8 con regla de contragolpe: si no progresas en 6 s, balón al profe.',
     E'20 conos\n2 porterías\n16 petos\n1 balón',
     '[{"item":"conos","qty":20},{"item":"porterías","qty":2},{"item":"petos","qty":16},{"item":"balón","qty":1}]'::jsonb, 20, 2),
    (sid, cid, 'Juego',
     '11v11 reducido o 9v9. Contar contraataques exitosos.',
     E'2 porterías\n18 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":18},{"item":"balón","qty":1}]'::jsonb, 25, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Abiezer', 'U15', CURRENT_DATE + 4,
    '[ejemplo] Bloque medio: compactación y saltos de presión',
    'Fuerza-resistencia',
    'Unidad del bloque',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Shadow defending: bloque de 6 se mueve según balón sin contacto.',
     E'12 conos\n1 balón',
     '[{"item":"conos","qty":12},{"item":"balón","qty":1}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     '6v6. Distancia entre líneas ≤ 12 m. Coach mide y corrige.',
     E'20 conos\n12 petos\n1 balón',
     '[{"item":"conos","qty":20},{"item":"petos","qty":12},{"item":"balón","qty":1}]'::jsonb, 18, 1),
    (sid, cid, 'Aplicación',
     '8v8. Trigger: salto del pivote cuando el rival da espalda.',
     E'16 conos\n2 porterías\n16 petos\n1 balón',
     '[{"item":"conos","qty":16},{"item":"porterías","qty":2},{"item":"petos","qty":16},{"item":"balón","qty":1}]'::jsonb, 20, 2),
    (sid, cid, 'Juego',
     '10v10. Penalización: línea rota (hueco >15 m) = saque rival.',
     E'2 porterías\n20 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":20},{"item":"balón","qty":1}]'::jsonb, 25, 3);

  -- ── Mayor · Cesar Vasquez ──────────────────────────────────
  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Cesar Vasquez', 'Mayor', CURRENT_DATE,
    '[ejemplo] Organización ofensiva 1-4-3-3: amplitud y interiores',
    'Capacidad aeróbica + cambios de ritmo',
    'Liderazgo en el campo',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Posesión 8v8+3. Extremos siempre abiertos; interiores entre líneas.',
     E'20 conos\n1 balón\n19 petos',
     '[{"item":"conos","qty":20},{"item":"balón","qty":1},{"item":"petos","qty":19}]'::jsonb, 15, 0),
    (sid, cid, 'Aprendizaje',
     'Patrones de llegada: lateral → interior → extremo → área.',
     E'24 conos\n4 balones',
     '[{"item":"conos","qty":24},{"item":"balones","qty":4}]'::jsonb, 20, 1),
    (sid, cid, 'Aplicación',
     '11v7 (ataque vs defensa numérica). Remate en 12 s.',
     E'2 porterías\n18 petos\n3 balones',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":18},{"item":"balones","qty":3}]'::jsonb, 20, 2),
    (sid, cid, 'Juego',
     '11v11. Condición: mínimo un extremo toca antes del remate.',
     E'2 porterías\n22 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":22},{"item":"balón","qty":1}]'::jsonb, 30, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Cesar Vasquez', 'Mayor', CURRENT_DATE + 2,
    '[ejemplo] Bloque bajo y salida en largo controlada',
    'Fuerza + potencia',
    'Concentración en momentos difíciles',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Shape drill: 1-5-4-1 compacto. Balón del profe a distintos sectores.',
     E'16 conos\n1 balón',
     '[{"item":"conos","qty":16},{"item":"balón","qty":1}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     'Defensa de área + primer pase largo a referencia. 2 referencias fijas.',
     E'20 conos\n8 balones\n1 portería',
     '[{"item":"conos","qty":20},{"item":"balones","qty":8},{"item":"portería","qty":1}]'::jsonb, 18, 1),
    (sid, cid, 'Aplicación',
     '10v10. Equipo A ataca 2/3; equipo B defiende bajo y sale en 2 toques.',
     E'2 porterías\n20 petos\n2 balones',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":20},{"item":"balones","qty":2}]'::jsonb, 22, 2),
    (sid, cid, 'Juego',
     '11v11. Contar salidas limpias (pase al tercio contrario sin pérdida).',
     E'2 porterías\n22 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":22},{"item":"balón","qty":1}]'::jsonb, 28, 3);

  INSERT INTO public.profe_training_sessions (
    company_id, coach_name, category, scheduled_date,
    general_objective, physical_objective, devotional_theme, is_template
  ) VALUES (
    cid, 'Cesar Vasquez', 'Mayor', CURRENT_DATE + 4,
    '[ejemplo] Balón parado: córner y falta lateral',
    'Activación neuromuscular',
    'Detalle y repetición',
    false
  ) RETURNING id INTO sid;
  INSERT INTO public.profe_training_phases (
    session_id, company_id, phase_name, explanation, variants_materials,
    materials_json, duration_minutes, sort_order
  ) VALUES
    (sid, cid, 'Orientación',
     'Movilidad + tiros libres sin oposición (técnica de golpeo).',
     E'12 balones\n6 conos',
     '[{"item":"balones","qty":12},{"item":"conos","qty":6}]'::jsonb, 12, 0),
    (sid, cid, 'Aprendizaje',
     'Córner corto y largo. Roles: 1er palo, 2do palo, rechazo, remate.',
     E'10 balones\n1 portería\n12 conos',
     '[{"item":"balones","qty":10},{"item":"portería","qty":1},{"item":"conos","qty":12}]'::jsonb, 20, 1),
    (sid, cid, 'Aplicación',
     'Falta lateral a 25 m. Bloqueo/desmarque ensayado vs 6 defensores.',
     E'8 balones\n1 portería\n12 petos',
     '[{"item":"balones","qty":8},{"item":"portería","qty":1},{"item":"petos","qty":12}]'::jsonb, 18, 2),
    (sid, cid, 'Juego',
     '11v11. Cada 6 min se fuerza un córner o falta ensayada.',
     E'2 porterías\n22 petos\n1 balón',
     '[{"item":"porterías","qty":2},{"item":"petos","qty":22},{"item":"balón","qty":1}]'::jsonb, 25, 3);

END $$;
