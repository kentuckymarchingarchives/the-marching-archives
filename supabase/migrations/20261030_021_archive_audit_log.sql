-- The Marching Archives — Phase 2: append-only database audit log
-- Run as the project database owner in Supabase SQL Editor.
-- Existing archive records are not changed. Events are captured AFTER installation only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.archive_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_user_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  record_id text NOT NULL,
  old_values jsonb,
  new_values jsonb
);
CREATE INDEX IF NOT EXISTS archive_audit_events_time_idx
  ON public.archive_audit_events (occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS archive_audit_events_record_idx
  ON public.archive_audit_events (table_name, record_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS archive_audit_events_actor_idx
  ON public.archive_audit_events (actor_user_id, occurred_at DESC);

ALTER TABLE public.archive_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.archive_audit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.archive_audit_events_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.archive_audit_events TO authenticated;

DROP POLICY IF EXISTS archive_audit_owner_admin_read ON public.archive_audit_events;
CREATE POLICY archive_audit_owner_admin_read ON public.archive_audit_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_members s
    WHERE s.user_id = (SELECT auth.uid())
      AND s.status = 'active' AND s.role IN ('owner','admin')
  ));

-- SECURITY DEFINER only for the trigger's internal insert, never exposed as RPC.
-- Store whitelisted archive fields; omit free-text notes, source links, and auth credentials.
CREATE OR REPLACE FUNCTION public.tma_record_audit_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  before_row jsonb;
  after_row jsonb;
  before_safe jsonb;
  after_safe jsonb;
  key_name text;
  record_key text;
  columns_to_record text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    after_row := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    before_row := to_jsonb(OLD);
  ELSE
    before_row := to_jsonb(OLD);
    after_row := to_jsonb(NEW);
  END IF;

  -- Explicit allowlist: never copy whole rows or sensitive free-text into the log.
  columns_to_record := CASE TG_TABLE_NAME
    WHEN 'staff_members' THEN ARRAY['user_id','role','status']
    WHEN 'bands' THEN ARRAY['id','name','kind','city','state','country','competitive_status']
    WHEN 'band_names' THEN ARRAY['id','band_id','historical_name','start_year','end_year']
    WHEN 'competitions' THEN ARRAY['id','name','season_year','organization_code','competition_type','competition_format','smbc_stage','competition_date','publication_status','published_at','archived_at']
    WHEN 'competition_rounds' THEN ARRAY['id','competition_id','name','round_kind','class_scope','sort_order']
    WHEN 'competition_entries' THEN ARRAY['id','round_id','band_id','classification','total_score','overall_placement','class_placement','penalty']
    WHEN 'score_captions' THEN ARRAY['id','round_id','name','caption_group','max_score','sort_order']
    WHEN 'caption_scores' THEN ARRAY['id','entry_id','caption_id','score']
    WHEN 'power_ranking_editions' THEN ARRAY['id','organization_code','season_year','name','publication_status']
    WHEN 'power_ranking_sections' THEN ARRAY['id','edition_id','section_type','name','sort_order','entry_limit']
    WHEN 'power_ranking_entries' THEN ARRAY['id','edition_id','section_id','band_id','rank','position','rating']
    WHEN 'competition_sources' THEN ARRAY['id','competition_id','title','source_type','reviewed_at']
    WHEN 'historical_documents' THEN ARRAY['id','title','season_year','publication_status','source_type']
    ELSE ARRAY['id']
  END;

  SELECT COALESCE(jsonb_object_agg(k, before_row -> k), '{}'::jsonb)
    INTO before_safe
    FROM unnest(columns_to_record) AS k
    WHERE before_row ? k;
  SELECT COALESCE(jsonb_object_agg(k, after_row -> k), '{}'::jsonb)
    INTO after_safe
    FROM unnest(columns_to_record) AS k
    WHERE after_row ? k;

  IF TG_OP = 'UPDATE' AND before_safe = after_safe THEN
    RETURN NEW;
  END IF;
  key_name := CASE WHEN TG_TABLE_NAME = 'staff_members' THEN 'user_id' ELSE 'id' END;
  record_key := COALESCE(after_row ->> key_name, before_row ->> key_name, '(unknown)');

  INSERT INTO public.archive_audit_events
    (actor_user_id, table_name, operation, record_id, old_values, new_values)
  VALUES
    (auth.uid(), TG_TABLE_NAME, TG_OP, record_key,
     CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE before_safe END,
     CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE after_safe END);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.tma_record_audit_event() FROM PUBLIC, anon, authenticated;

-- Capture core records and whichever optional feature tables are already installed.
-- Does not require 018/019/020 or any optional migration to have run.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'staff_members','bands','band_names','competitions','competition_rounds',
    'competition_entries','score_captions','caption_scores',
    'power_ranking_editions','power_ranking_sections','power_ranking_entries',
    'competition_sources','historical_documents'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tma_audit_change ON public.%I', t);
      EXECUTE format('CREATE TRIGGER tma_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tma_record_audit_event()', t);
    END IF;
  END LOOP;
END $$;
COMMIT;
