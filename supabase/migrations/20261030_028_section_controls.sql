-- TMA: Owner-managed public section maintenance controls.
-- After migration 020 (staff management). Run once in Supabase SQL Editor.
BEGIN;

CREATE TABLE IF NOT EXISTS public.site_section_controls (
  section_key text PRIMARY KEY,
  section_name text NOT NULL,
  is_offline boolean NOT NULL DEFAULT false,
  notice text NOT NULL DEFAULT 'We are updating this section of The Marching Archives. Please check back soon.',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_section_controls ENABLE ROW LEVEL SECURITY;
-- No direct SELECT/INSERT/UPDATE/DELETE policies: use the narrow RPCs below.
REVOKE ALL ON TABLE public.site_section_controls FROM PUBLIC, anon, authenticated;

INSERT INTO public.site_section_controls (section_key, section_name)
VALUES
 ('bands','Bands & Corps'),
 ('competitions','Competitions & Results'),
 ('organizations','Organizations'),
 ('seasons','Season Explorer'),
 ('championships','Championship Records'),
 ('documents','Historical Documents'),
 ('leaderboards','Leaderboards'),
 ('power-rankings','Power Rankings'),
 ('compare','Band Comparisons'),
 ('search','Advanced Search'),
 ('team','Meet the Team')
ON CONFLICT (section_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tma_public_section_status(p_section_key text)
RETURNS TABLE(section_key text, section_name text, is_offline boolean, notice text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT s.section_key, s.section_name, s.is_offline, s.notice
  FROM public.site_section_controls AS s
  WHERE s.section_key = p_section_key;
$$;

CREATE OR REPLACE FUNCTION public.tma_owner_list_section_controls()
RETURNS TABLE(section_key text, section_name text, is_offline boolean, notice text, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members AS m
    WHERE m.user_id = (SELECT auth.uid()) AND m.role = 'owner' AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active Owners may view section controls.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT s.section_key, s.section_name, s.is_offline, s.notice, s.updated_at
  FROM public.site_section_controls s ORDER BY s.section_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.tma_owner_set_section_control(
  p_section_key text, p_is_offline boolean, p_notice text
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_message text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members AS m
    WHERE m.user_id = (SELECT auth.uid()) AND m.role = 'owner' AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active Owners may modify section controls.' USING ERRCODE = '42501';
  END IF;
  IF p_section_key IS NULL OR p_is_offline IS NULL THEN
    RAISE EXCEPTION 'Invalid section or status.' USING ERRCODE = '22023';
  END IF;
  v_message := pg_catalog.btrim(COALESCE(p_notice, ''));
  IF length(v_message) < 10 OR length(v_message) > 500 THEN
    RAISE EXCEPTION 'Maintenance notice must be 10 to 500 characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.site_section_controls AS s
  SET is_offline = p_is_offline, notice = v_message,
      updated_by = (SELECT auth.uid()), updated_at = now()
  WHERE s.section_key = p_section_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown section.' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.tma_public_section_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_public_section_status(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.tma_owner_list_section_controls() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_owner_list_section_controls() TO authenticated;
REVOKE ALL ON FUNCTION public.tma_owner_set_section_control(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_owner_set_section_control(text, boolean, text) TO authenticated;
COMMIT;
