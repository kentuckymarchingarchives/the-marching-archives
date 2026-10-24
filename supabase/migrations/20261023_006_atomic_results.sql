
CREATE OR REPLACE FUNCTION public.save_round_entry_result(
  p_entry_id uuid,
  p_round_id uuid,
  p_classification text,
  p_total_score numeric,
  p_class_placement integer,
  p_overall_placement integer,
  p_notes text,
  p_caption_scores jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org text;
  v_scope text;
  v_status text;
  v_caption jsonb;
  v_caption_id uuid;
  v_value numeric;
  v_max numeric;
  v_allowed text[];
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.staff_members s
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
      AND s.role IN ('owner', 'admin', 'editor')
  ) THEN
    RAISE EXCEPTION 'Active staff access is required';
  END IF;

  SELECT
    c.organization_code,
    c.publication_status,
    r.class_scope
  INTO
    v_org,
    v_status,
    v_scope
  FROM public.competition_entries e
  JOIN public.competition_rounds r
    ON r.id = e.round_id
  JOIN public.competitions c
    ON c.id = r.competition_id
  WHERE e.id = p_entry_id
    AND r.id = p_round_id
  FOR UPDATE OF e, c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Result entry not found';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Published results cannot be edited';
  END IF;

  IF v_org IN ('KMEA', 'MSBA') THEN
    v_allowed := ARRAY['1A', '2A', '3A', '4A', '5A'];
  ELSIF v_org = 'BOA' THEN
    v_allowed := ARRAY['1A', '2A', '3A', '4A'];
  ELSIF v_org = 'DCI' THEN
    v_allowed := ARRAY[
      'World', 'Open', 'All-Age', 'International'
    ];
  ELSE
    RAISE EXCEPTION 'Unknown organization';
  END IF;

  IF p_classification IS NOT NULL
     AND NOT (p_classification = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Invalid classification';
  END IF;

  IF v_scope IS NOT NULL
     AND p_classification IS DISTINCT FROM v_scope THEN
    RAISE EXCEPTION 'Classification does not match round';
  END IF;

  IF p_total_score IS NOT NULL AND (
    p_total_score < 0 OR
    p_total_score > 999999 OR
    p_total_score <> round(p_total_score, 4)
  ) THEN
    RAISE EXCEPTION 'Invalid total score';
  END IF;

  IF p_class_placement IS NOT NULL AND
     p_class_placement < 1 THEN
    RAISE EXCEPTION 'Invalid class placement';
  END IF;

  IF p_overall_placement IS NOT NULL AND
     p_overall_placement < 1 THEN
    RAISE EXCEPTION 'Invalid overall placement';
  END IF;

  IF length(coalesce(p_notes, '')) > 5000 THEN
    RAISE EXCEPTION 'Notes are too long';
  END IF;

  IF jsonb_typeof(p_caption_scores) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Caption scores must be an array';
  END IF;

  -- Validate all caption scores before writing anything.
  FOR v_caption IN
    SELECT value
    FROM jsonb_array_elements(p_caption_scores)
  LOOP
    IF jsonb_typeof(v_caption) <> 'object'
       OR NOT (v_caption ? 'caption_id')
       OR NOT (v_caption ? 'score') THEN
      RAISE EXCEPTION 'Invalid caption score item';
    END IF;

    v_caption_id := (v_caption ->> 'caption_id')::uuid;

    SELECT sc.max_score
    INTO v_max
    FROM public.score_captions sc
    WHERE sc.id = v_caption_id
      AND sc.round_id = p_round_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Caption does not belong to round';
    END IF;

    IF jsonb_typeof(v_caption -> 'score') = 'null' THEN
      v_value := NULL;
    ELSIF jsonb_typeof(v_caption -> 'score') = 'number' THEN
      v_value := (v_caption ->> 'score')::numeric;
    ELSE
      RAISE EXCEPTION 'Invalid caption score value';
    END IF;

    IF v_value IS NOT NULL AND (
      v_value < 0 OR
      v_value > v_max OR
      v_value <> round(v_value, 4)
    ) THEN
      RAISE EXCEPTION 'Caption score exceeds permitted range';
    END IF;
  END LOOP;

  UPDATE public.competition_entries
  SET
    classification = p_classification,
    total_score = p_total_score,
    class_placement = p_class_placement,
    overall_placement = p_overall_placement,
    notes = p_notes
  WHERE id = p_entry_id
    AND round_id = p_round_id;

  FOR v_caption IN
    SELECT value
    FROM jsonb_array_elements(p_caption_scores)
  LOOP
    v_caption_id := (v_caption ->> 'caption_id')::uuid;

    IF jsonb_typeof(v_caption -> 'score') = 'null' THEN
      DELETE FROM public.caption_scores
      WHERE entry_id = p_entry_id
        AND caption_id = v_caption_id;
    ELSE
      v_value := (v_caption ->> 'score')::numeric;

      INSERT INTO public.caption_scores (
        entry_id,
        caption_id,
        score
      )
      VALUES (
        p_entry_id,
        v_caption_id,
        v_value
      )
      ON CONFLICT (entry_id, caption_id)
      DO UPDATE SET score = EXCLUDED.score;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.save_round_entry_result(
  uuid, uuid, text, numeric, integer, integer, text, jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.save_round_entry_result(
  uuid, uuid, text, numeric, integer, integer, text, jsonb
) FROM anon;

GRANT EXECUTE ON FUNCTION public.save_round_entry_result(
  uuid, uuid, text, numeric, integer, integer, text, jsonb
) TO authenticated;
