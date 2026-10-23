
-- ============================================
-- THE MARCHING ARCHIVES
-- MIGRATION 002: DATABASE INTEGRITY
-- Requires migration 001
-- ============================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ============================================
-- 1. VALID COMPETITION FORMATS
-- ============================================

CREATE OR REPLACE FUNCTION
public.tma_validate_competition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- KMEA
  IF NEW.organization_code = 'KMEA' THEN
    IF NEW.competition_type = 'regular_season'
       AND NEW.competition_format NOT IN (
         'single_show',
         'prelims_finals',
         'custom'
       )
    THEN
      RAISE EXCEPTION
        'Invalid KMEA regular-season format';
    END IF;

    IF NEW.competition_type = 'smbc'
       AND NEW.competition_format NOT IN (
         'single_show',
         'custom'
       )
    THEN
      RAISE EXCEPTION
        'SMBC must use single-show or custom format';
    END IF;
  END IF;

  -- MSBA
  IF NEW.organization_code = 'MSBA' THEN
    IF NEW.competition_type = 'regular_season'
       AND NEW.competition_format NOT IN (
         'single_show',
         'prelims_finals',
         'custom'
       )
    THEN
      RAISE EXCEPTION
        'Invalid MSBA regular-season format';
    END IF;

    IF NEW.competition_type = 'championships'
       AND NEW.competition_format NOT IN (
         'prelims_finals',
         'custom'
       )
    THEN
      RAISE EXCEPTION
        'Invalid MSBA championship format';
    END IF;
  END IF;

  -- BOA
  IF NEW.organization_code = 'BOA' THEN
    IF NEW.competition_type IN (
      'regional',
      'super_regional'
    )
    AND NEW.competition_format NOT IN (
      'prelims_finals',
      'custom'
    )
    THEN
      RAISE EXCEPTION
        'Invalid BOA regional format';
    END IF;

    IF NEW.competition_type = 'grand_nationals'
       AND NEW.competition_format NOT IN (
         'prelims_semis_finals',
         'custom'
       )
    THEN
      RAISE EXCEPTION
        'Invalid BOA Grand Nationals format';
    END IF;
  END IF;

  -- DCI
  IF NEW.organization_code = 'DCI' THEN
    IF NEW.competition_type = 'world_championship'
       AND NEW.competition_format NOT IN (
         'class_specific',
         'custom'
       )
    THEN
      RAISE EXCEPTION
        'DCI World Championships require class-specific or custom format';
    END IF;

    IF NEW.competition_type = 'regular_competition'
       AND NEW.competition_format NOT IN (
         'single_show',
         'prelims_finals',
         'prelims_semis_finals',
         'custom'
       )
    THEN
      RAISE EXCEPTION
        'Invalid DCI regular competition format';
    END IF;
  END IF;

  -- Do not silently invalidate existing results
  -- by changing the organization after rounds exist.
  IF TG_OP = 'UPDATE'
     AND NEW.organization_code
         IS DISTINCT FROM OLD.organization_code
     AND EXISTS (
       SELECT 1
       FROM public.competition_rounds r
       WHERE r.competition_id = OLD.id
     )
  THEN
    RAISE EXCEPTION
      'Cannot change organization while competition rounds exist';
  END IF;

  -- Publishing is restricted to Owners/Admins.
  IF NEW.publication_status = 'published'
     AND (
       TG_OP = 'INSERT'
       OR OLD.publication_status
          IS DISTINCT FROM 'published'
     )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.staff_members s
      WHERE s.user_id = (SELECT auth.uid())
        AND s.status = 'active'
        AND s.role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION
        'Only an Owner or Administrator may publish';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.publication_status = 'published'
     AND NEW.publication_status <> 'published'
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.staff_members s
      WHERE s.user_id = (SELECT auth.uid())
        AND s.status = 'active'
        AND s.role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION
        'Only an Owner or Administrator may unpublish';
    END IF;
  END IF;

  IF NEW.publication_status = 'published' THEN
    NEW.published_at :=
      COALESCE(NEW.published_at, now());
  ELSE
    NEW.published_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  tma_competition_integrity
ON public.competitions;

CREATE TRIGGER tma_competition_integrity
BEFORE INSERT OR UPDATE
ON public.competitions
FOR EACH ROW
EXECUTE FUNCTION
  public.tma_validate_competition();


-- ============================================
-- 2. CLASSIFICATION VALIDATION
-- ============================================

CREATE OR REPLACE FUNCTION
public.tma_valid_band_class(
  p_organization text,
  p_class text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_class IS NULL THEN true

    WHEN p_organization IN ('KMEA', 'MSBA')
      THEN p_class IN (
        '1A', '2A', '3A', '4A', '5A'
      )

    WHEN p_organization = 'BOA'
      THEN p_class IN (
        '1A', '2A', '3A', '4A'
      )

    WHEN p_organization = 'DCI'
      THEN p_class IN (
        'World',
        'Open',
        'All-Age',
        'International'
      )

    ELSE false
  END;
$$;


-- ============================================
-- 3. ROUND VALIDATION
-- ============================================

CREATE OR REPLACE FUNCTION
public.tma_validate_round()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_org text;
  v_type text;
BEGIN
  SELECT
    organization_code,
    competition_type
  INTO v_org, v_type
  FROM public.competitions
  WHERE id = NEW.competition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Competition not found';
  END IF;

  IF NOT public.tma_valid_band_class(
    v_org,
    NEW.class_scope
  ) THEN
    RAISE EXCEPTION
      'Invalid round classification for organization %',
      v_org;
  END IF;

  IF NEW.class_scope = '' THEN
    RAISE EXCEPTION
      'Round class scope must be NULL or a valid class';
  END IF;

  -- A round cannot be moved between competitions
  -- while score entries are attached.
  IF TG_OP = 'UPDATE'
     AND NEW.competition_id
         IS DISTINCT FROM OLD.competition_id
     AND EXISTS (
       SELECT 1
       FROM public.competition_entries e
       WHERE e.round_id = OLD.id
     )
  THEN
    RAISE EXCEPTION
      'Cannot move a round with existing entries';
  END IF;

  -- Existing entries must remain compatible
  -- if a round's class restriction changes.
  IF TG_OP = 'UPDATE'
     AND NEW.class_scope
         IS DISTINCT FROM OLD.class_scope
     AND NEW.class_scope IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.competition_entries e
       WHERE e.round_id = OLD.id
         AND e.classification
             IS DISTINCT FROM NEW.class_scope
     )
  THEN
    RAISE EXCEPTION
      'Existing entries do not match new round class';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  tma_round_integrity
ON public.competition_rounds;

CREATE TRIGGER tma_round_integrity
BEFORE INSERT OR UPDATE
ON public.competition_rounds
FOR EACH ROW
EXECUTE FUNCTION
  public.tma_validate_round();


-- ============================================
-- 4. COMPETITION ENTRY VALIDATION
-- ============================================

CREATE OR REPLACE FUNCTION
public.tma_validate_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_org text;
  v_scope text;
BEGIN
  SELECT
    c.organization_code,
    r.class_scope
  INTO
    v_org,
    v_scope
  FROM public.competition_rounds r
  JOIN public.competitions c
    ON c.id = r.competition_id
  WHERE r.id = NEW.round_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Competition round not found';
  END IF;

  IF NEW.classification = '' THEN
    RAISE EXCEPTION
      'Use NULL for unclassified entries';
  END IF;

  IF NOT public.tma_valid_band_class(
    v_org,
    NEW.classification
  ) THEN
    RAISE EXCEPTION
      'Class % is not valid for %',
      NEW.classification, v_org;
  END IF;

  -- DCI World Prelims, for example, must only
  -- contain World Class entries.
  IF v_scope IS NOT NULL
     AND NEW.classification
         IS DISTINCT FROM v_scope
  THEN
    RAISE EXCEPTION
      'Entry classification must match round class %',
      v_scope;
  END IF;

  IF NEW.total_score < 0 THEN
    RAISE EXCEPTION
      'Total score cannot be negative';
  END IF;

  -- Prevent moving an existing entry to a
  -- different round when it already has scores.
  IF TG_OP = 'UPDATE'
     AND NEW.round_id IS DISTINCT FROM OLD.round_id
     AND EXISTS (
       SELECT 1
       FROM public.caption_scores cs
       WHERE cs.entry_id = OLD.id
     )
  THEN
    RAISE EXCEPTION
      'Cannot move an entry with caption scores';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  tma_entry_integrity
ON public.competition_entries;

CREATE TRIGGER tma_entry_integrity
BEFORE INSERT OR UPDATE
ON public.competition_entries
FOR EACH ROW
EXECUTE FUNCTION
  public.tma_validate_entry();


-- ============================================
-- 5. CAPTION SCORE VALIDATION
-- ============================================

CREATE OR REPLACE FUNCTION
public.tma_validate_caption_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_entry_round uuid;
  v_caption_round uuid;
  v_max numeric;
BEGIN
  SELECT round_id
  INTO v_entry_round
  FROM public.competition_entries
  WHERE id = NEW.entry_id;

  SELECT
    round_id,
    max_score
  INTO
    v_caption_round,
    v_max
  FROM public.score_captions
  WHERE id = NEW.caption_id;

  IF v_entry_round IS NULL
     OR v_caption_round IS NULL
  THEN
    RAISE EXCEPTION
      'Entry or caption not found';
  END IF;

  IF v_entry_round <> v_caption_round THEN
    RAISE EXCEPTION
      'Caption and entry belong to different rounds';
  END IF;

  IF NEW.score > v_max THEN
    RAISE EXCEPTION
      'Caption score exceeds maximum allowed score';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  tma_caption_score_integrity
ON public.caption_scores;

CREATE TRIGGER tma_caption_score_integrity
BEFORE INSERT OR UPDATE
ON public.caption_scores
FOR EACH ROW
EXECUTE FUNCTION
  public.tma_validate_caption_score();


-- ============================================
-- 6. PREVENT INVALID CAPTION MODIFICATIONS
-- ============================================

CREATE OR REPLACE FUNCTION
public.tma_validate_caption_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND EXISTS (
       SELECT 1
       FROM public.caption_scores cs
       WHERE cs.caption_id = OLD.id
         AND (
           NEW.round_id IS DISTINCT FROM OLD.round_id
           OR cs.score > NEW.max_score
         )
     )
  THEN
    RAISE EXCEPTION
      'Caption change conflicts with saved scores';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  tma_caption_definition_integrity
ON public.score_captions;

CREATE TRIGGER tma_caption_definition_integrity
BEFORE UPDATE
ON public.score_captions
FOR EACH ROW
EXECUTE FUNCTION
  public.tma_validate_caption_definition();


-- ============================================
-- 7. HELPERS FOR STAFF FORMS
-- ============================================

CREATE OR REPLACE FUNCTION
public.tma_competition_class_options(
  p_organization text
)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_organization IN ('KMEA', 'MSBA')
      THEN ARRAY['1A','2A','3A','4A','5A']::text[]

    WHEN p_organization = 'BOA'
      THEN ARRAY['1A','2A','3A','4A']::text[]

    WHEN p_organization = 'DCI'
      THEN ARRAY[
        'World',
        'Open',
        'All-Age',
        'International'
      ]::text[]

    ELSE ARRAY[]::text[]
  END;
$$;

COMMIT;
