
-- =============================================
-- THE MARCHING ARCHIVES
-- MIGRATION 001: INITIAL DATABASE SCHEMA
-- =============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------
-- 1. ORGANIZATIONS
-- ---------------------------------------------

CREATE TABLE public.organizations (
  code text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (code, name)
VALUES
  ('KMEA', 'Kentucky Music Educators Association'),
  ('MSBA', 'Mid-States Band Association'),
  ('BOA', 'Bands of America'),
  ('DCI', 'Drum Corps International');

-- ---------------------------------------------
-- 2. STAFF
-- ---------------------------------------------

CREATE TABLE public.staff_members (
  user_id uuid PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,

  role text NOT NULL DEFAULT 'editor'
    CHECK (role IN ('owner', 'admin', 'editor')),

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------
-- 3. BANDS AND CORPS
-- ---------------------------------------------

CREATE TABLE public.bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL,
  kind text NOT NULL DEFAULT 'marching_band'
    CHECK (
      kind IN ('marching_band', 'drum_corps', 'other')
    ),

  city text,
  state text,
  country text NOT NULL DEFAULT 'United States',

  notes text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.band_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  band_id uuid NOT NULL
    REFERENCES public.bands(id) ON DELETE CASCADE,

  historical_name text NOT NULL,
  start_year integer,
  end_year integer,

  CHECK (
    start_year IS NULL
    OR end_year IS NULL
    OR start_year <= end_year
  )
);

CREATE INDEX band_names_band_idx
  ON public.band_names(band_id);

-- ---------------------------------------------
-- 4. COMPETITIONS
-- ---------------------------------------------

CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL,
  season_year integer NOT NULL
    CHECK (season_year BETWEEN 1800 AND 2200),

  organization_code text NOT NULL
    REFERENCES public.organizations(code),

  competition_type text NOT NULL,

  competition_format text NOT NULL
    CHECK (
      competition_format IN (
        'single_show',
        'prelims_finals',
        'prelims_semis_finals',
        'class_specific',
        'custom'
      )
    ),

  smbc_stage text,

  competition_date date,
  city text,
  state text,
  country text NOT NULL DEFAULT 'United States',

  source_url text,
  notes text,

  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published')),

  published_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_organization_competition_type
  CHECK (
    (
      organization_code = 'KMEA'
      AND competition_type IN ('regular_season', 'smbc')
    )
    OR
    (
      organization_code = 'MSBA'
      AND competition_type IN ('regular_season', 'championships')
    )
    OR
    (
      organization_code = 'BOA'
      AND competition_type IN (
        'regional',
        'super_regional',
        'grand_nationals'
      )
    )
    OR
    (
      organization_code = 'DCI'
      AND competition_type IN (
        'regular_competition',
        'world_championship'
      )
    )
  ),

  CONSTRAINT valid_smbc_stage
  CHECK (
    (
      organization_code = 'KMEA'
      AND competition_type = 'smbc'
      AND smbc_stage IN (
        'regionals_quarterfinals',
        'semifinals',
        'finals',
        'semifinals_finals'
      )
    )
    OR
    (
      competition_type <> 'smbc'
      AND smbc_stage IS NULL
    )
  )
);

CREATE INDEX competitions_season_idx
  ON public.competitions(season_year DESC);

CREATE INDEX competitions_organization_idx
  ON public.competitions(organization_code);

CREATE INDEX competitions_status_idx
  ON public.competitions(publication_status);

-- ---------------------------------------------
-- 5. COMPETITION ROUNDS
-- ---------------------------------------------

CREATE TABLE public.competition_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  competition_id uuid NOT NULL
    REFERENCES public.competitions(id) ON DELETE CASCADE,

  name text NOT NULL,

  round_kind text NOT NULL
    CHECK (
      round_kind IN (
        'single_show',
        'regionals_quarterfinals',
        'prelims',
        'semifinals',
        'finals',
        'custom'
      )
    ),

  -- Optional class-specific round.
  -- Example: DCI World Class Prelims.
  class_scope text,

  sort_order integer NOT NULL DEFAULT 1,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX competition_rounds_competition_idx
  ON public.competition_rounds(competition_id);

-- ---------------------------------------------
-- 6. COMPETITION ENTRIES
-- ---------------------------------------------

CREATE TABLE public.competition_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  round_id uuid NOT NULL
    REFERENCES public.competition_rounds(id) ON DELETE CASCADE,

  band_id uuid NOT NULL
    REFERENCES public.bands(id),

  -- Classification belongs to this performance.
  classification text,

  total_score numeric(10,4),

  class_placement integer
    CHECK (class_placement > 0),

  overall_placement integer
    CHECK (overall_placement > 0),

  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (round_id, band_id)
);

CREATE INDEX competition_entries_round_idx
  ON public.competition_entries(round_id);

CREATE INDEX competition_entries_band_idx
  ON public.competition_entries(band_id);

-- ---------------------------------------------
-- 7. CAPTIONS
-- ---------------------------------------------

CREATE TABLE public.score_captions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  round_id uuid NOT NULL
    REFERENCES public.competition_rounds(id) ON DELETE CASCADE,

  name text NOT NULL,

  max_score numeric(10,4) NOT NULL DEFAULT 100
    CHECK (max_score > 0),

  multiplier numeric(10,4) NOT NULL DEFAULT 1
    CHECK (multiplier >= 0),

  sort_order integer NOT NULL DEFAULT 1,

  UNIQUE (round_id, name)
);

CREATE TABLE public.caption_scores (
  entry_id uuid NOT NULL
    REFERENCES public.competition_entries(id) ON DELETE CASCADE,

  caption_id uuid NOT NULL
    REFERENCES public.score_captions(id) ON DELETE CASCADE,

  score numeric(10,4) NOT NULL
    CHECK (score >= 0),

  PRIMARY KEY (entry_id, caption_id)
);

-- ---------------------------------------------
-- 8. SECURITY HELPERS
-- ---------------------------------------------

CREATE FUNCTION public.tma_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = (SELECT auth.uid())
      AND status = 'active'
      AND role IN ('owner', 'admin', 'editor')
  );
$$;

CREATE FUNCTION public.tma_can_manage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = (SELECT auth.uid())
      AND status = 'active'
      AND role IN ('owner', 'admin', 'editor')
  );
$$;

CREATE FUNCTION public.tma_can_read_competition(
  p_competition_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.competitions c
    WHERE c.id = p_competition_id
      AND (
        c.publication_status = 'published'
        OR public.tma_is_staff()
      )
  );
$$;

-- ---------------------------------------------
-- 9. ENABLE ROW LEVEL SECURITY
-- ---------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_captions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caption_scores ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- 10. PUBLIC READING POLICIES
-- ---------------------------------------------

CREATE POLICY organizations_public_read
ON public.organizations
FOR SELECT
USING (true);

CREATE POLICY bands_public_read
ON public.bands
FOR SELECT
USING (true);

CREATE POLICY band_names_public_read
ON public.band_names
FOR SELECT
USING (true);

CREATE POLICY competitions_read
ON public.competitions
FOR SELECT
USING (
  publication_status = 'published'
  OR public.tma_is_staff()
);

CREATE POLICY rounds_read
ON public.competition_rounds
FOR SELECT
USING (
  public.tma_can_read_competition(competition_id)
);

CREATE POLICY entries_read
ON public.competition_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_read_competition(
        r.competition_id
      )
  )
);

CREATE POLICY captions_read
ON public.score_captions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_rounds r
    WHERE r.id = round_id
      AND public.tma_can_read_competition(
        r.competition_id
      )
  )
);

CREATE POLICY caption_scores_read
ON public.caption_scores
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.competition_entries e
    JOIN public.competition_rounds r
      ON r.id = e.round_id
    WHERE e.id = entry_id
      AND public.tma_can_read_competition(
        r.competition_id
      )
  )
);

-- ---------------------------------------------
-- 11. STAFF READING POLICY
-- ---------------------------------------------

CREATE POLICY staff_self_read
ON public.staff_members
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.tma_is_staff()
);

-- ---------------------------------------------
-- 12. STAFF WRITE POLICIES
-- ---------------------------------------------

-- Staff management itself is deliberately
-- excluded. Staff role changes will use
-- a separate Owner-only workflow.

CREATE POLICY bands_staff_write
ON public.bands
FOR ALL
TO authenticated
USING (public.tma_can_manage())
WITH CHECK (public.tma_can_manage());

CREATE POLICY band_names_staff_write
ON public.band_names
FOR ALL
TO authenticated
USING (public.tma_can_manage())
WITH CHECK (public.tma_can_manage());

CREATE POLICY competitions_staff_write
ON public.competitions
FOR ALL
TO authenticated
USING (public.tma_can_manage())
WITH CHECK (public.tma_can_manage());

CREATE POLICY rounds_staff_write
ON public.competition_rounds
FOR ALL
TO authenticated
USING (public.tma_can_manage())
WITH CHECK (public.tma_can_manage());

CREATE POLICY entries_staff_write
ON public.competition_entries
FOR ALL
TO authenticated
USING (public.tma_can_manage())
WITH CHECK (public.tma_can_manage());

CREATE POLICY captions_staff_write
ON public.score_captions
FOR ALL
TO authenticated
USING (public.tma_can_manage())
WITH CHECK (public.tma_can_manage());

CREATE POLICY caption_scores_staff_write
ON public.caption_scores
FOR ALL
TO authenticated
USING (public.tma_can_manage())
WITH CHECK (public.tma_can_manage());

COMMIT;
