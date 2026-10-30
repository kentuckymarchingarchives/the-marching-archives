-- TMA: Owner-only staff management, including last-owner protection.
-- Run once in Supabase SQL Editor after backing up the database.
BEGIN;

CREATE OR REPLACE FUNCTION public.tma_manage_staff_member(
  p_user_id uuid,
  p_role text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.staff_members%ROWTYPE;
BEGIN
  -- Serialize ALL staff role changes to prevent a concurrent last-owner race.
  PERFORM pg_catalog.pg_advisory_xact_lock(20261030, 20);

  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = (SELECT auth.uid())
      AND role = 'owner' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only an active Owner may manage staff.' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_role NOT IN ('owner','admin','editor')
     OR p_status NOT IN ('active','inactive')
     OR p_role IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'Invalid staff account, role, or status.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.staff_members
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF FOUND AND v_existing.role = 'owner' AND v_existing.status = 'active'
     AND (p_role <> 'owner' OR p_status <> 'active')
     AND (SELECT count(*) FROM public.staff_members
          WHERE role = 'owner' AND status = 'active') <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last active Owner.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.staff_members (user_id, role, status)
  VALUES (p_user_id, p_role, p_status)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role, status = EXCLUDED.status;
END;
$$;

REVOKE ALL ON FUNCTION public.tma_manage_staff_member(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tma_manage_staff_member(uuid,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.tma_manage_staff_member(uuid,text,text) TO authenticated;

-- The existing staff_members table keeps RLS on; no direct write policy added.
COMMIT;
