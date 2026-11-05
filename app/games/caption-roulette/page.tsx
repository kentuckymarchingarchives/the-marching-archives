import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeGamePool } from "@/lib/caption-roulette";
import CaptionRouletteClient from "@/components/games/CaptionRouletteClient";

type Mode = "classic" | "daily" | "year" | "class";
type Props = { searchParams: Promise<{ mode?: string; year?: string; class?: string }> };

async function Game({ searchParams }: Props) {
  await connection();
  const query = await searchParams;
  const mode: Mode = ["daily", "year", "class"].includes(query.mode ?? "") ? query.mode as Mode : "classic";
  const yearNum = Number(query.year);
  const year = mode === "year" ? (Number.isInteger(yearNum) && yearNum >= 1996 && yearNum <= new Date().getFullYear() ? yearNum : new Date().getFullYear()) : null;
  const chosenClass = mode === "class" ? (/^[a-zA-Z0-9 /-]{1,50}$/.test(query.class ?? "") ? query.class! : "1A") : null;
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tma_games_caption_pool", {
    p_year: year,
    p_class: chosenClass,
  });
  const pool = error ? { slots: [], candidates: [], message: `Unable to load the caption pool. Confirm that migration 043 is installed. (${error.message})` } : normalizeGamePool(data);
  return <CaptionRouletteClient pool={pool} mode={mode} year={year} chosenClass={chosenClass} dayKey={dayKey}/>;
}

export default function CaptionRoulettePage(props: Props) {
  return <Suspense fallback={<div role="status" className="mx-auto max-w-5xl px-6 py-20 text-[#002144]">Loading historical caption scores…</div>}><Game searchParams={props.searchParams}/></Suspense>;
}
