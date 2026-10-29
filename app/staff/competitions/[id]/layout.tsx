import type { ReactNode } from "react";

// Individual management, round, review and publishing pages provide
// their own contextual heading. Avoid stacking duplicate toolbars here.
export default function CompetitionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
