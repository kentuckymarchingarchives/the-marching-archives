-- The Marching Archives: public staff directory (opt-in only)
-- Requires staff management (020), names (024), profile customization (026).
BEGIN;
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS show_on_public_team boolean NOT NULL DEFAULT false;

-- Never expose raw staff_members to unauthenticated users.
-- The public RPC deliberately returns no user IDs, roles, emails, or greeting names.
CREATE OR REPLACE FUNCTION public.tma_public_team()
RETURNS TABLE (
  display_name text,
  staff_title text,
  biography text,
  research_specialties text,
  profile_photo_url text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT btrim(s.display_name), s.staff_title, s.biography,
         s.research_specialties, s.profile_photo_url
  FROM public.staff_members s
  WHERE s.status = 'active'
    AND s.role IN ('owner','admin','editor')
    AND s.show_on_public_team = true
    AND s.display_name IS NOT NULL
    AND btrim(s.display_name) <> ''
  ORDER BY CASE s.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    lower(btrim(s.display_name));
$$;
REVOKE ALL ON FUNCTION public.tma_public_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tma_public_team() TO anon, authenticated;

-- Visibility can be changed only by an authenticated active Owner.
CREATE OR REPLACE FUNCTION public.tma_set_public_team_visibility(
  p_user_id uuid, p_visible boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members me
    WHERE me.user_id = (SELECT auth.uid())
      AND me.role = 'owner' AND me.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active Owners can change public team visibility.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_visible IS NULL THEN
    RAISE EXCEPTION 'Invalid visibility settings.' USING ERRCODE = '22023';
  END IF;
  IF p_visible AND NOT EXISTS (
    SELECT 1 FROM public.staff_members s
    WHERE s.user_id = p_user_id AND s.status = 'active'
      AND s.role IN ('owner','admin','editor')
      AND s.display_name IS NOT NULL AND btrim(s.display_name) <> ''
  ) THEN
    RAISE EXCEPTION 'Only active staff with a Display name can be published.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.staff_members
    SET show_on_public_team = p_visible
    WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.tma_set_public_team_visibility(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tma_set_public_team_visibility(uuid,boolean) TO authenticated;
COMMIT;
