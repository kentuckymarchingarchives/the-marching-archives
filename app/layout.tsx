
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import "./globals.css";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "The Marching Archives",
    template: "%s | The Marching Archives",
  },
  description:
    "Explore the history of competitive marching bands and drum corps through archived competition results, scores, placements, and historical records.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <Suspense fallback={<div className="h-20 border-b border-slate-200 bg-white" aria-hidden="true" />}>
          <SiteHeader />
        </Suspense>

        <div className="flex-1">
          {children}
        </div>

        <SiteFooter />
      </body>
    </html>
  );
}
