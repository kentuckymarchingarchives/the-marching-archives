-- TMA 026: Owner-managed staff biographies, titles, specialties and profile image URLs.
-- Requires 020, 022, 024, 025. Run as project administrator in Supabase SQL Editor.
BEGIN;
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS staff_title text,
  ADD COLUMN IF NOT EXISTS biography text,
  ADD COLUMN IF NOT EXISTS research_specialties text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text;
ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_profile_fields_length;
ALTER TABLE public.staff_members
  ADD CONSTRAINT staff_members_profile_fields_length CHECK (
    (staff_title IS NULL OR length(staff_title) BETWEEN 1 AND 100) AND
    (biography IS NULL OR length(biography) BETWEEN 1 AND 1000) AND
    (research_specialties IS NULL OR length(research_specialties) BETWEEN 1 AND 300) AND
    (profile_photo_url IS NULL OR (length(profile_photo_url) <= 500 AND profile_photo_url ~ '^https://[^[:space:]]+$'))
  );

-- Separate RPC keeps profile changes distinct from role and status changes.
CREATE OR REPLACE FUNCTION public.tma_update_staff_bio(
  p_user_id uuid,
  p_staff_title text,
  p_biography text,
  p_research_specialties text,
  p_profile_photo_url text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_title text := nullif(pg_catalog.btrim(p_staff_title), '');
  v_bio text := nullif(pg_catalog.btrim(p_biography), '');
  v_specialties text := nullif(pg_catalog.btrim(p_research_specialties), '');
  v_photo text := nullif(pg_catalog.btrim(p_profile_photo_url), '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner' AND status = 'active') THEN
    RAISE EXCEPTION 'Only an active Owner may manage staff profiles.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL
    OR length(coalesce(p_staff_title,'')) > 150 OR length(coalesce(p_biography,'')) > 1100
    OR length(coalesce(p_research_specialties,'')) > 350 OR length(coalesce(p_profile_photo_url,'')) > 550
    OR (v_title IS NOT NULL AND length(v_title) > 100)
    OR (v_bio IS NOT NULL AND length(v_bio) > 1000)
    OR (v_specialties IS NOT NULL AND length(v_specialties) > 300)
    OR (v_photo IS NOT NULL AND (length(v_photo) > 500 OR v_photo !~ '^https://[^[:space:]]+$')) THEN
    RAISE EXCEPTION 'Invalid staff profile details.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.staff_members SET
    staff_title = v_title, biography = v_bio,
    research_specialties = v_specialties, profile_photo_url = v_photo
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff member not found.' USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.tma_update_staff_bio(uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_update_staff_bio(uuid,text,text,text,text) TO authenticated;

-- Replace 025's safe staff-only directory with additional non-secret profile fields.
DROP FUNCTION IF EXISTS public.tma_staff_profile_directory();
CREATE FUNCTION public.tma_staff_profile_directory()
RETURNS TABLE (
  user_id uuid, display_name text, greeting_name text, role text, status text,
  staff_title text, biography text, research_specialties text, profile_photo_url text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.user_id, s.display_name, s.greeting_name, s.role::text, s.status::text,
    s.staff_title, s.biography, s.research_specialties, s.profile_photo_url
  FROM public.staff_members s
  WHERE EXISTS (
    SELECT 1 FROM public.staff_members viewer
    WHERE viewer.user_id = (SELECT auth.uid())
      AND viewer.status = 'active' AND viewer.role IN ('owner','admin','editor')
  ) AND s.status = 'active' AND s.role IN ('owner','admin','editor')
  ORDER BY CASE s.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    coalesce(nullif(btrim(s.display_name),''), nullif(btrim(s.greeting_name),''), 'Staff member'), s.user_id;
$$;
REVOKE ALL ON FUNCTION public.tma_staff_profile_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_staff_profile_directory() TO authenticated;
COMMIT;
