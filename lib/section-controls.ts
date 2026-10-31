
/**
 * Public website sections that Owners can
 * temporarily place into maintenance mode.
 */

export const managedSections = [
  "bands",
  "competitions",
  "organizations",
  "seasons",
  "championships",
  "documents",
  "leaderboards",
  "power-rankings",
  "compare",
  "search",
  "team",
] as const;

/**
 * Returns the controlled section for a public URL.
 * For example:
 * /bands/123/statistics -> "bands"
 * /staff/dashboard -> null
 */
export function sectionKeyFromPath(
  pathname: string
): string | null {
  const key = pathname.split("/").filter(Boolean)[0] ?? "";

  return (managedSections as readonly string[]).includes(key)
    ? key
    : null;
}
