
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

/**
 * Checks whether an identifier is a database UUID.
 */
export function isRecordId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Accepts either an existing UUID or a clean URL slug.
 */
export function validPublicIdentifier(
  value: string
): boolean {
  if (!value || value.length > 200) {
    return false;
  }

  return (
    isRecordId(value) ||
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

/**
 * Loads a competition using either its UUID or slug.
 * Only published, non-archived records are returned.
 */
export async function getPublicCompetition(
  identifier: string
) {
  if (!validPublicIdentifier(identifier)) {
    notFound();
  }

  const supabase = await createClient();

  const column = isRecordId(identifier)
    ? "id"
    : "slug";

  const { data: competition, error } = await supabase
    .from("competitions")
    .select(
      "id, slug, name, season_year, organization_code, competition_type, competition_format, smbc_stage, competition_date, city, state, country, source_url, notes"
    )
    .eq(column, identifier)
    .eq("publication_status", "published")
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    console.error(
      "Unable to load public competition:",
      error.message
    );

    throw new Error(
      "Unable to retrieve published competition."
    );
  }

  if (!competition) {
    notFound();
  }

  return {
    supabase,
    competition,
  };
}

/**
 * Creates the public URL for a competition.
 */
export function competitionPublicUrl(
  slug: string
): string {
  return `/competitions/${slug}`;
}

/**
 * Creates the public URL for an individual round.
 */
export function roundPublicUrl(
  competitionSlug: string,
  roundSlug: string
): string {
  return (
    `/competitions/${competitionSlug}` +
    `/rounds/${roundSlug}`
  );
}
