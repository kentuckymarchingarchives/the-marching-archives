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
      { label: "Historical Documents", href: "/documents", description: "Documents and archive sources" },
    ],
  },
  {
    label: "Statistics",
    links: [
      { label: "Leaderboards", href: "/leaderboards", description: "Historical leaders and records" },
      { label: "Power Rankings", href: "/power-rankings", description: "Published KMEA and BOA rankings" },
      { label: "Ranking History", href: "/power-rankings/history", description: "Rank changes across editions" },
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
