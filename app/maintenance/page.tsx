
import type { Metadata } from "next";
import SectionOffline from "@/components/SectionOffline";

export const metadata: Metadata = {
  title: "Section Offline | The Marching Archives",
  description:
    "This section of The Marching Archives is temporarily unavailable.",
  robots: { index: false, follow: true },
};

export default function MaintenancePage() {
  return (
    <SectionOffline
      sectionName="This section"
      message="We're updating this section of The Marching Archives to make it better. Other areas of the archive are still available. Thank you for your patience."
    />
  );
}
