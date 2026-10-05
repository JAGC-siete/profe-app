-- Academia fields on profe_players + seed 15 kids × 5 categories

ALTER TABLE public.profe_players
  ADD COLUMN IF NOT EXISTS jersey_number INT NULL,
  ADD COLUMN IF NOT EXISTS birthdate DATE NULL,
  ADD COLUMN IF NOT EXISTS guardian_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

ALTER TABLE public.profe_players
  DROP CONSTRAINT IF EXISTS profe_players_jersey_number_range;
ALTER TABLE public.profe_players
  ADD CONSTRAINT profe_players_jersey_number_range
  CHECK (jersey_number IS NULL OR (jersey_number >= 1 AND jersey_number <= 99));

ALTER TABLE public.profe_players
  DROP CONSTRAINT IF EXISTS profe_players_guardian_phone_len;
ALTER TABLE public.profe_players
  ADD CONSTRAINT profe_players_guardian_phone_len
  CHECK (char_length(guardian_phone) <= 40);

ALTER TABLE public.profe_players
  DROP CONSTRAINT IF EXISTS profe_players_notes_len;
ALTER TABLE public.profe_players
  ADD CONSTRAINT profe_players_notes_len
  CHECK (char_length(notes) <= 500);

CREATE INDEX IF NOT EXISTS idx_profe_players_company_category_active
  ON public.profe_players(company_id, category, is_active);

COMMENT ON COLUMN public.profe_players.jersey_number IS 'Dorsal 1–99 (opcional).';
COMMENT ON COLUMN public.profe_players.birthdate IS 'Fecha de nacimiento para calcular edad.';
COMMENT ON COLUMN public.profe_players.guardian_phone IS 'Tel / WhatsApp del tutor.';
COMMENT ON COLUMN public.profe_players.notes IS 'Notas internas; seed usa [ejemplo].';

-- Seed 15 jugadores por categoría (idempotente)
DO $$
DECLARE
  cid UUID;
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
    RAISE NOTICE 'profe_players seed skipped: no company';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profe_players
    WHERE company_id = cid AND notes = '[ejemplo]'
  ) THEN
    RAISE NOTICE 'sample players already present, skipping seed';
    RETURN;
  END IF;

  -- U7 (~2018–2019)
  INSERT INTO public.profe_players (
    company_id, name, category, jersey_number, birthdate, guardian_phone, notes, is_active
  ) VALUES
    (cid, 'Mateo Hernández', 'U7', 1, '2018-03-12', '+50490001001', '[ejemplo]', true),
    (cid, 'Santiago López', 'U7', 2, '2018-05-21', '+50490001002', '[ejemplo]', true),
    (cid, 'Lucas Martínez', 'U7', 3, '2018-07-08', '+50490001003', '[ejemplo]', true),
    (cid, 'Benjamín Ruiz', 'U7', 4, '2018-09-15', '+50490001004', '[ejemplo]', true),
    (cid, 'Emiliano Castro', 'U7', 5, '2018-11-02', '+50490001005', '[ejemplo]', true),
    (cid, 'Thiago Méndez', 'U7', 6, '2019-01-19', '+50490001006', '[ejemplo]', true),
    (cid, 'Diego Pineda', 'U7', 7, '2019-02-27', '+50490001007', '[ejemplo]', true),
    (cid, 'Gael Flores', 'U7', 8, '2019-04-03', '+50490001008', '[ejemplo]', true),
    (cid, 'Ian Espinal', 'U7', 9, '2019-06-14', '+50490001009', '[ejemplo]', true),
    (cid, 'Noah García', 'U7', 10, '2019-08-22', '+50490001010', '[ejemplo]', true),
    (cid, 'Samuel Rivera', 'U7', 11, '2018-02-05', '+50490001011', '[ejemplo]', true),
    (cid, 'Julián Mejía', 'U7', 12, '2018-10-30', '+50490001012', '[ejemplo]', true),
    (cid, 'Tomás Aguilar', 'U7', 13, '2019-03-11', '+50490001013', '[ejemplo]', true),
    (cid, 'Ángel Padilla', 'U7', 14, '2019-05-18', '+50490001014', '[ejemplo]', true),
    (cid, 'Dylan Ordoñez', 'U7', 15, '2018-12-09', '+50490001015', '[ejemplo]', true);

  -- U9 (~2016–2017)
  INSERT INTO public.profe_players (
    company_id, name, category, jersey_number, birthdate, guardian_phone, notes, is_active
  ) VALUES
    (cid, 'Andrés Zelaya', 'U9', 1, '2016-02-14', '+50490002001', '[ejemplo]', true),
    (cid, 'Sebastián Coello', 'U9', 2, '2016-04-28', '+50490002002', '[ejemplo]', true),
    (cid, 'Nicolás Banegas', 'U9', 3, '2016-06-07', '+50490002003', '[ejemplo]', true),
    (cid, 'Matías Lanza', 'U9', 4, '2016-08-19', '+50490002004', '[ejemplo]', true),
    (cid, 'Ethan Amador', 'U9', 5, '2016-10-03', '+50490002005', '[ejemplo]', true),
    (cid, 'Adrián Suazo', 'U9', 6, '2017-01-16', '+50490002006', '[ejemplo]', true),
    (cid, 'Bruno Cálix', 'U9', 7, '2017-03-25', '+50490002007', '[ejemplo]', true),
    (cid, 'Leo Varela', 'U9', 8, '2017-05-09', '+50490002008', '[ejemplo]', true),
    (cid, 'Axel Portillo', 'U9', 9, '2017-07-21', '+50490002009', '[ejemplo]', true),
    (cid, 'Kevin Orellana', 'U9', 10, '2017-09-02', '+50490002010', '[ejemplo]', true),
    (cid, 'Isaac Canales', 'U9', 11, '2016-11-13', '+50490002011', '[ejemplo]', true),
    (cid, 'Joel Alvarado', 'U9', 12, '2016-01-30', '+50490002012', '[ejemplo]', true),
    (cid, 'Cristian Palma', 'U9', 13, '2017-12-08', '+50490002013', '[ejemplo]', true),
    (cid, 'Fabián Reyes', 'U9', 14, '2017-02-17', '+50490002014', '[ejemplo]', true),
    (cid, 'Hugo Mendoza', 'U9', 15, '2016-09-26', '+50490002015', '[ejemplo]', true);

  -- U13 (~2012–2013)
  INSERT INTO public.profe_players (
    company_id, name, category, jersey_number, birthdate, guardian_phone, notes, is_active
  ) VALUES
    (cid, 'Daniel Núñez', 'U13', 1, '2012-03-04', '+50490003001', '[ejemplo]', true),
    (cid, 'José Carlos López', 'U13', 2, '2012-05-17', '+50490003002', '[ejemplo]', true),
    (cid, 'Miguel Ángel Soto', 'U13', 3, '2012-07-29', '+50490003003', '[ejemplo]', true),
    (cid, 'Carlos Eduardo Díaz', 'U13', 4, '2012-09-11', '+50490003004', '[ejemplo]', true),
    (cid, 'Fernando Javier', 'U13', 5, '2012-11-23', '+50490003005', '[ejemplo]', true),
    (cid, 'Ricardo Paz', 'U13', 6, '2013-01-08', '+50490003006', '[ejemplo]', true),
    (cid, 'Erick Mendoza', 'U13', 7, '2013-02-20', '+50490003007', '[ejemplo]', true),
    (cid, 'Álex Romero', 'U13', 8, '2013-04-14', '+50490003008', '[ejemplo]', true),
    (cid, 'Pablo Castellanos', 'U13', 9, '2013-06-27', '+50490003009', '[ejemplo]', true),
    (cid, 'David Figueroa', 'U13', 10, '2013-08-05', '+50490003010', '[ejemplo]', true),
    (cid, 'Jonathan Meza', 'U13', 11, '2012-12-16', '+50490003011', '[ejemplo]', true),
    (cid, 'Bryan Acosta', 'U13', 12, '2012-02-09', '+50490003012', '[ejemplo]', true),
    (cid, 'César Maradiaga', 'U13', 13, '2013-10-01', '+50490003013', '[ejemplo]', true),
    (cid, 'Óscar Peralta', 'U13', 14, '2013-11-19', '+50490003014', '[ejemplo]', true),
    (cid, 'Luis Fernando Cruz', 'U13', 15, '2012-06-22', '+50490003015', '[ejemplo]', true);

  -- U15 (~2010–2011)
  INSERT INTO public.profe_players (
    company_id, name, category, jersey_number, birthdate, guardian_phone, notes, is_active
  ) VALUES
    (cid, 'Gabriel Santos', 'U15', 1, '2010-01-15', '+50490004001', '[ejemplo]', true),
    (cid, 'Esteban Rivas', 'U15', 2, '2010-03-28', '+50490004002', '[ejemplo]', true),
    (cid, 'Mauricio Elvir', 'U15', 3, '2010-05-06', '+50490004003', '[ejemplo]', true),
    (cid, 'Héctor Bonilla', 'U15', 4, '2010-07-19', '+50490004004', '[ejemplo]', true),
    (cid, 'Roberto Cálix', 'U15', 5, '2010-09-30', '+50490004005', '[ejemplo]', true),
    (cid, 'Wilmer Sorto', 'U15', 6, '2011-02-11', '+50490004006', '[ejemplo]', true),
    (cid, 'Allan Ponce', 'U15', 7, '2011-04-23', '+50490004007', '[ejemplo]', true),
    (cid, 'Kevin Mejía', 'U15', 8, '2011-06-08', '+50490004008', '[ejemplo]', true),
    (cid, 'Cristopher Lara', 'U15', 9, '2011-08-17', '+50490004009', '[ejemplo]', true),
    (cid, 'Eduardo Valladares', 'U15', 10, '2011-10-29', '+50490004010', '[ejemplo]', true),
    (cid, 'Nelson Amaya', 'U15', 11, '2010-12-03', '+50490004011', '[ejemplo]', true),
    (cid, 'Javier Rivera', 'U15', 12, '2010-02-21', '+50490004012', '[ejemplo]', true),
    (cid, 'Marvin Zúniga', 'U15', 13, '2011-01-07', '+50490004013', '[ejemplo]', true),
    (cid, 'Álvaro Caballero', 'U15', 14, '2011-11-14', '+50490004014', '[ejemplo]', true),
    (cid, 'Denis Flores', 'U15', 15, '2010-08-25', '+50490004015', '[ejemplo]', true);

  -- Mayor (~1995–2005)
  INSERT INTO public.profe_players (
    company_id, name, category, jersey_number, birthdate, guardian_phone, notes, is_active
  ) VALUES
    (cid, 'Carlos Gómez', 'Mayor', 1, '1995-04-12', '+50490005001', '[ejemplo]', true),
    (cid, 'José Martínez', 'Mayor', 2, '1996-07-03', '+50490005002', '[ejemplo]', true),
    (cid, 'Luis Hernández', 'Mayor', 3, '1997-01-21', '+50490005003', '[ejemplo]', true),
    (cid, 'Mario López', 'Mayor', 4, '1998-09-08', '+50490005004', '[ejemplo]', true),
    (cid, 'Pedro Castillo', 'Mayor', 5, '1999-11-16', '+50490005005', '[ejemplo]', true),
    (cid, 'Rafael Mejía', 'Mayor', 6, '2000-02-27', '+50490005006', '[ejemplo]', true),
    (cid, 'Antonio Díaz', 'Mayor', 7, '2001-05-14', '+50490005007', '[ejemplo]', true),
    (cid, 'Manuel Pineda', 'Mayor', 8, '2002-08-01', '+50490005008', '[ejemplo]', true),
    (cid, 'Jorge Escobar', 'Mayor', 9, '2003-03-19', '+50490005009', '[ejemplo]', true),
    (cid, 'Francisco Reyes', 'Mayor', 10, '2004-06-25', '+50490005010', '[ejemplo]', true),
    (cid, 'Andrés Velásquez', 'Mayor', 11, '2005-10-09', '+50490005011', '[ejemplo]', true),
    (cid, 'Óscar Medina', 'Mayor', 12, '1997-12-30', '+50490005012', '[ejemplo]', true),
    (cid, 'Ernesto Aguilar', 'Mayor', 13, '1998-04-18', '+50490005013', '[ejemplo]', true),
    (cid, 'Víctor Ramos', 'Mayor', 14, '2000-09-22', '+50490005014', '[ejemplo]', true),
    (cid, 'Saúl Torrez', 'Mayor', 15, '2001-12-05', '+50490005015', '[ejemplo]', true);
END $$;
