"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
type Stats = { played: number; best: number; total: number; dailyDays: string[] };
const getSnapshot = () => { try { return typeof window === "undefined" ? "" : localStorage.getItem("tma_caption_roulette_local_v1") ?? ""; } catch { return ""; } };
const getServerSnapshot = () => "";
const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener("tma:games-updated", notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener("tma:games-updated", notify); };
};
export default function GamesProfilePage() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  let stats: Stats = { played: 0, best: 0, total: 0, dailyDays: [] };
  try { if (raw) stats = JSON.parse(raw) as Stats; } catch { /* ignore malformed local values */ }
  return <main className="mx-auto max-w-3xl px-6 py-16"><Link href="/games" className="text-sm font-bold text-[#861F41]">← TMA Games</Link>
    <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#861F41]">Local device records</p><h1 className="mt-2 font-serif text-4xl font-bold text-[#002144]">My Games Profile</h1>
    <p className="mt-3 text-sm leading-7 text-slate-600">These stats are saved in this browser only. They are not authenticated, transferable, or eligible for verified online leaderboards.</p>
    <div className="mt-7 grid gap-4 sm:grid-cols-2">{[
      ["Games played", stats.played.toLocaleString()], ["Personal best", stats.best.toFixed(3)],
      ["Average score", (stats.played ? stats.total / stats.played : 0).toFixed(3)],
      ["Daily challenges completed", stats.dailyDays.length.toLocaleString()],
    ].map(([label,value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-[#002144]">{value}</p></div>)}</div>
    <Link href="/games/caption-roulette" className="mt-7 inline-block rounded-lg bg-[#861F41] px-5 py-3 font-bold text-white">Play Caption Roulette</Link>
  </main>;
}
