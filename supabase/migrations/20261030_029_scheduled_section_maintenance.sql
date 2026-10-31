-- Phase 029: Owner-scheduled section maintenance. Requires migration 028.
-- Uses database clock (now()) so no cron job, redeploy, or background task is required.
BEGIN;

ALTER TABLE public.site_section_controls
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

ALTER TABLE public.site_section_controls
  DROP CONSTRAINT IF EXISTS tma_section_schedule_pair;
ALTER TABLE public.site_section_controls
  ADD CONSTRAINT tma_section_schedule_pair CHECK (
    (scheduled_start_at IS NULL AND scheduled_end_at IS NULL)
    OR
    (scheduled_start_at IS NOT NULL AND scheduled_end_at IS NOT NULL
      AND scheduled_end_at > scheduled_start_at)
  );

-- Preserve existing return columns and permissions: clients and proxy remain compatible.
-- is_offline now represents the EFFECTIVE status (manual switch OR active schedule).
CREATE OR REPLACE FUNCTION public.tma_public_section_status(p_section_key text)
RETURNS TABLE(section_key text, section_name text, is_offline boolean, notice text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT s.section_key, s.section_name,
         (s.is_offline OR (
           s.scheduled_start_at IS NOT NULL
           AND s.scheduled_end_at IS NOT NULL
           AND now() >= s.scheduled_start_at
           AND now() < s.scheduled_end_at
         )) AS is_offline,
         s.notice
  FROM public.site_section_controls AS s
  WHERE s.section_key = p_section_key;
$$;

-- Only active Owners may view schedules. Do not expose dates publicly.
CREATE OR REPLACE FUNCTION public.tma_owner_list_section_schedules()
RETURNS TABLE(
  section_key text,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  schedule_active boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members m
    WHERE m.user_id = (SELECT auth.uid()) AND m.role = 'owner' AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active Owners may view schedules.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.section_key, s.scheduled_start_at, s.scheduled_end_at,
      (s.scheduled_start_at IS NOT NULL AND s.scheduled_end_at IS NOT NULL
       AND now() >= s.scheduled_start_at AND now() < s.scheduled_end_at)
    FROM public.site_section_controls s ORDER BY s.section_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.tma_owner_set_section_schedule(
  p_section_key text,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members m
    WHERE m.user_id = (SELECT auth.uid()) AND m.role = 'owner' AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active Owners may set schedules.' USING ERRCODE = '42501';
  END IF;
  IF ((p_start_at IS NULL) <> (p_end_at IS NULL)) THEN
    RAISE EXCEPTION 'Provide both start and end, or neither.' USING ERRCODE = '22023';
  END IF;
  IF p_start_at IS NOT NULL AND (p_end_at <= p_start_at OR p_end_at <= now()) THEN
    RAISE EXCEPTION 'Schedule must have a future end after its start.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.site_section_controls s
  SET scheduled_start_at = p_start_at,
      scheduled_end_at = p_end_at,
      updated_by = (SELECT auth.uid()),
      updated_at = now()
  WHERE s.section_key = p_section_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown section.' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.tma_owner_list_section_schedules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_owner_list_section_schedules() TO authenticated;
REVOKE ALL ON FUNCTION public.tma_owner_set_section_schedule(text,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_owner_set_section_schedule(text,timestamptz,timestamptz) TO authenticated;

COMMIT;
