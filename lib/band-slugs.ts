
export const BAND_SLUG_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createBandSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+(high|middle)\s+school$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return slug || "band";
}

export function validateCustomBandSlug(
  value: string
): string | null {
  const slug = value.trim();

  if (!slug) {
    return null;
  }

  if (
    slug.length > 150 ||
    !BAND_SLUG_PATTERN.test(slug)
  ) {
    throw new Error(
      "The custom URL must use lowercase letters, numbers, and hyphens only, up to 150 characters."
    );
  }

  return slug;
}
