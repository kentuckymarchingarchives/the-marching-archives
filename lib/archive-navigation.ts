/** Shared public navigation. Update URLs here once for desktop and mobile. */
export const primaryNavigation = [
  { label: "Bands & Corps", href: "/bands" },
  { label: "Competitions", href: "/competitions" },
] as const;

export const navigationGroups = [
  {
    label: "Explore",
    links: [
      { label: "Organizations", href: "/organizations", description: "Competitive organizations" },
      { label: "Season Explorer", href: "/seasons", description: "Browse history by season" },
      { label: "Championships", href: "/championships", description: "Championship results and records" },
      { label: "Featured Competitions", href: "/featured", description: "Owner-curated historical contests" },
      { label: "On This Day", href: "/on-this-day", description: "Competitions held on today's calendar date" },
      { label: "Archive Coverage", href: "/coverage", description: "Published results by year and organization" },
      { label: "Recently Verified", href: "/recently-verified", description: "Current verified historical results" },
      { label: "Historical Documents", href: "/documents", description: "Documents and archive sources" },
    ],
  },
  {
    label: "Statistics",
    links: [
      { label: "Leaderboards", href: "/leaderboards", description: "Historical leaders and records" },
      { label: "Power Rankings", href: "/power-rankings", description: "Published KMEA and BOA rankings" },
      { label: "Ranking History", href: "/power-rankings/history", description: "Rank changes across editions" },
      { label: "Historical Rivalries", href: "/rivalries", description: "Documented head-to-head meetings" },
      { label: "Compare Bands", href: "/compare", description: "Side-by-side ensemble comparisons" },
    ],
  },
  {
    label: "About",
    links: [
      { label: "Meet the Team", href: "/team", description: "The people behind the archive" },
      { label: "Submit a Correction", href: "/corrections", description: "Help improve archive accuracy" },
    ],
  },
] as const;

export const searchNavigation = { label: "Search Archive", href: "/search" } as const;
