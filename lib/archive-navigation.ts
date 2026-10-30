/** Central navigation registry: desktop and mobile menus read the same arrays. */
export const primaryNavigation = [
  { label: "Bands & Corps", href: "/bands" },
  { label: "Competitions", href: "/competitions" },
] as const;

export const navigationGroups = [
  {
    label: "Explore",
    links: [
      { label: "Organizations", href: "/organizations", description: "Explore competition organizations" },
      { label: "Season Explorer", href: "/seasons", description: "Discover results by year" },
      { label: "Championships", href: "/championships", description: "Browse championship records" },
      { label: "Historical Documents", href: "/documents", description: "Research and archival sources" },
    ],
  },
  {
    label: "Statistics",
    links: [
      { label: "Leaderboards", href: "/leaderboards", description: "All-time archive rankings" },
      { label: "Power Rankings", href: "/power-rankings", description: "Manually published KMEA & BOA rankings" },
      { label: "Ranking History", href: "/power-rankings/history", description: "Ranking movement over time" },
      { label: "Compare Bands", href: "/compare", description: "Compare ensemble records" },
    ],
  },
  {
    label: "About",
    links: [
      { label: "Meet the Team", href: "/team", description: "People behind the archive" },
      { label: "Submit a Correction", href: "/corrections", description: "Help improve historical records" },
    ],
  },
] as const;

// Change a URL here if your deployed route has a different name.
// Adding a link here updates BOTH the desktop and mobile navigation.
