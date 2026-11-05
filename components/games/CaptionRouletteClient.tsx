"use client";

import Link from "next/link";
import { useState } from "react";
import { Candidate, GamePool, Slot, fmt, points, seededShuffle } from "@/lib/caption-roulette";

type Mode = "classic" | "daily" | "year" | "class";
type Offer = { initial: Candidate; replacement: Candidate };
type Decision = { slot: Slot; selected: Candidate; initial: Candidate; gambled: boolean };
type Session = { offers: Offer[]; index: number; tokens: number; choices: Decision[]; seed: string };
const storageKey = "tma_caption_roulette_local_v1";

type Stats = { played: number; best: number; total: number; dailyDays: string[] };
function saveStats(score: number, mode: Mode, dayKey: string) {
  try {
    const previous = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Stats | null;
    const next: Stats = {
      played: (previous?.played ?? 0) + 1,
      best: Math.max(previous?.best ?? 0, score),
      total: (previous?.total ?? 0) + score,
      dailyDays: mode === "daily" ? Array.from(new Set([...(previous?.dailyDays ?? []), dayKey])).slice(-500) : (previous?.dailyDays ?? []),
    };
    localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new Event("tma:games-updated"));
  } catch { /* Game remains playable when local storage is blocked. */ }
}

function makeSession(pool: GamePool, mode: Mode, dayKey: string): Session {
  const seed = mode === "daily" ? `KMEA-daily-${dayKey}-v1` : globalThis.crypto?.randomUUID?.() ?? String(Math.random());
  const offers = pool.slots.map((slot, i) => {
    const matches = pool.candidates.filter(c => c.slotKey === slot.key);
    const shuffled = seededShuffle(matches, `${seed}:${i}:${slot.key}`);
    return { initial: shuffled[0], replacement: shuffled.find(c => c.key !== shuffled[0].key) ?? shuffled[1] };
  });
  return { offers, index: 0, tokens: Math.min(3, Math.max(1, Math.ceil(pool.slots.length / 2))), choices: [], seed };
}

export default function CaptionRouletteClient({ pool, mode, dayKey, year, chosenClass }: {
  pool: GamePool; mode: Mode; dayKey: string; year: number | null; chosenClass: string | null;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [finished, setFinished] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const completed = session?.choices ?? [];
  const total = completed.reduce((sum, v) => sum + points(v.selected), 0);
  const slot = session && pool.slots[session.index];
  const current = session && session.offers[session.index]?.initial;
  const maxPoints = slot ? slot.maximum * slot.multiplier : 0;
  const modeName = { classic: "Classic", daily: "Daily Challenge", year: "Year Challenge", class: "Class Challenge" }[mode];

  function decide(risk: boolean) {
    if (!session || !slot || !current || finished) return;
    const canRisk = risk && session.tokens > 0;
    const offer = session.offers[session.index];
    const selected = canRisk ? offer.replacement : offer.initial;
    const choices = [...session.choices, { slot, selected, initial: offer.initial, gambled: canRisk }];
    const updated = { ...session, index: session.index + 1, choices, tokens: session.tokens - Number(canRisk) };
    setSession(updated);
    if (updated.index >= pool.slots.length) {
      setFinished(true);
      saveStats(Math.round(choices.reduce((sum, d) => sum + points(d.selected), 0) * 1000) / 1000, mode, dayKey);
    }
  }

  return <div className="min-h-screen bg-[#F4F6F9] pb-16">
    <section className="bg-[#002144] px-5 py-10 text-white sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Link href="/games" className="text-sm font-semibold text-[#F2CBD8] hover:underline">← TMA Games</Link>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#E5B6C5]">KMEA · Historical scores from 1996 onward</p>
        <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight sm:text-5xl">Caption Roulette</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">Build a 100-point recap from real historical caption performances. Lock your score—or spend a gamble token and take whatever comes next.</p>
      </div>
    </section>
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <form action="/games/caption-roulette" method="get" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#002144]">Choose your game</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold text-[#002144]">Game mode
            <select name="mode" defaultValue={mode} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-[#861F41]">
              <option value="classic">Classic · any compatible year</option>
              <option value="daily">Daily · shared selections</option>
              <option value="year">Year Challenge</option>
              <option value="class">Class Challenge</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-[#002144]">Year (Year mode)
            <select name="year" defaultValue={year ?? 2026} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-[#861F41]">
              {Array.from({ length: 31 }, (_, i) => 2026 - i).map(y => <option value={y} key={y}>{y}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#002144]">Class (Class mode)
            <select name="class" defaultValue={chosenClass ?? "1A"} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-[#861F41]">
              {["1A", "2A", "3A", "4A", "5A", "A", "AA", "AAA", "AAAA", "AAAAA"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <button type="submit" className="mt-4 rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#701832] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">Load selected challenge</button>
        <p className="mt-3 text-xs text-slate-500">Year and Class filters apply only in their respective modes. Changing modes starts a new challenge.</p>
      </form>

      {!pool.slots.length ? <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-lg font-bold">Not enough historical caption data yet</h2>
        <p className="mt-2 text-sm leading-7">{pool.message ?? "We need complete published KMEA recaps with a matching 100-point scoring configuration before this mode can begin."}</p>
        <p className="mt-2 text-sm">Try Classic Mode or publish additional historically sourced caption scores in TMA.</p>
      </div> : <>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-[#861F41]">{modeName}{mode === "daily" ? ` · ${dayKey}` : ""}</p>
              <h2 className="mt-1 text-2xl font-bold text-[#002144]">Historical score sheet</h2></div>
            <button type="button" onClick={() => setShowRules(v => !v)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-[#002144] hover:bg-slate-50">{showRules ? "Hide rules" : "How to play"}</button>
          </div>
          {showRules && <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            The game uses a single matching KMEA caption configuration for each round. Each score is taken from a real published performance; its contribution is the recorded caption score × its recorded multiplier. You get one free selection per caption and a limited shared supply of gamble tokens. Gambling replaces your score permanently, with no second chance on that caption. No historical weights are invented. The Daily Challenge offers the same picks to visitors viewing the same source pool on the same Eastern Time date. Local-only records are not verified leaderboards.
          </div>}
          <div className="mt-5 space-y-3">
            {pool.slots.map((s, i) => {
              const done = completed[i];
              return <div key={s.key} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${done ? "border-emerald-200 bg-emerald-50" : i === session?.index ? "border-[#861F41] bg-[#FFF7FA]" : "border-slate-200 bg-slate-50"}`}>
                <div><p className="font-semibold text-[#002144]">{i + 1}. {s.name}</p><p className="text-xs text-slate-600">Maximum {(s.maximum * s.multiplier).toFixed(3)} points{s.multiplier !== 1 ? ` · historical multiplier ×${s.multiplier}` : ""}</p></div>
                <strong className="text-lg tabular-nums text-[#002144]">{done ? fmt(points(done.selected)) : "—"}</strong>
              </div>;
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div><p className="text-xs text-slate-500">Current game total</p><p className="text-3xl font-bold tabular-nums text-[#002144]">{fmt(total)} <span className="text-base font-normal text-slate-500">/ 100.000</span></p></div>
            {session && !finished && <p className="text-sm font-bold text-[#861F41]">{session.tokens} gamble token{session.tokens === 1 ? "" : "s"} remaining</p>}
          </div>
        </div>

        {!session && <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">{pool.slots.length} authentic caption slots · Scores drawn from compatible published KMEA recaps</p>
          <button type="button" onClick={() => { setSession(makeSession(pool, mode, dayKey)); setFinished(false); }} className="mt-4 rounded-lg bg-[#861F41] px-8 py-3 font-bold text-white hover:bg-[#701832] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">Start Caption Roulette</button>
        </div>}

        {session && !finished && slot && current && <section aria-live="polite" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#002144] p-6 text-white sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[#E8AFC2]">Turn {session.index + 1} of {pool.slots.length} · {slot.name}</p>
            <p className="mt-5 text-sm text-slate-200">Your randomly selected historical caption</p>
            <p className="mt-2 text-5xl font-bold tabular-nums sm:text-6xl">{fmt(points(current))}</p>
            <p className="mt-2 text-sm text-slate-200">out of {maxPoints.toFixed(3)} points · Recorded score {current.score.toFixed(3)}</p>
            <p className="mt-5 text-xs text-slate-300">The ensemble, year, competition, and source are revealed in your final recap.</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
            <button type="button" onClick={() => decide(false)} className="rounded-xl bg-[#002144] px-5 py-4 font-bold text-white hover:bg-[#003563] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002144]">Lock It In <span className="block text-xs font-normal opacity-80">Keep {fmt(points(current))}</span></button>
            <button type="button" disabled={session.tokens < 1} onClick={() => decide(true)} className="rounded-xl bg-[#861F41] px-5 py-4 font-bold text-white hover:bg-[#701832] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861F41]">Risk It · 1 Token <span className="block text-xs font-normal opacity-80">Replacement score is final</span></button>
          </div>
        </section>}

        {session && finished && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-widest text-[#861F41]">Game complete</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">Your Historical Recap</h2>
          <p className="mt-4 text-5xl font-bold tabular-nums text-[#002144]">{fmt(total)} <span className="text-lg font-normal text-slate-500">/ 100.000</span></p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Each entry below comes from an actual archived caption score. Your score combines performances from separate competitions, so it is a game result—not an official historical competition total.</p>
          <div className="mt-6 space-y-4">{completed.map((d, i) => <article key={d.slot.key} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-[#002144]">{i + 1}. {d.slot.name}</h3><strong className="tabular-nums text-[#861F41]">+{fmt(points(d.selected))}</strong></div>
            <p className="mt-2 text-sm font-semibold text-[#002144]">{d.selected.band} · {d.selected.year}</p>
            <p className="mt-1 text-sm text-slate-600">{d.selected.competition} · {d.selected.round}{d.selected.classification ? ` · Class ${d.selected.classification}` : ""}</p>
            <p className="mt-1 text-xs text-slate-500">Original caption: {d.selected.score.toFixed(3)} / {d.selected.maximum.toFixed(3)}{d.selected.multiplier !== 1 ? ` (× ${d.selected.multiplier})` : ""} · {d.gambled ? `Gambled from ${fmt(points(d.initial))}` : "Locked first selection"}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-[#861F41]">
              {d.selected.bandSlug && <Link className="hover:underline" href={`/bands/${d.selected.bandSlug}`}>View ensemble ↗</Link>}
              {d.selected.sourceUrl && /^https?:\/\//i.test(d.selected.sourceUrl) && <a href={d.selected.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">Historical source ↗</a>}
              {!d.selected.sourceUrl && <span className="font-normal text-slate-500">No source URL linked to this competition</span>}
            </div>
          </article>)}</div>
          <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => {setSession(makeSession(pool, mode, dayKey));setFinished(false);}} className="rounded-lg bg-[#861F41] px-5 py-3 font-bold text-white hover:bg-[#701832]">Play Again</button><Link href="/games/profile" className="rounded-lg border border-slate-300 px-5 py-3 font-bold text-[#002144] hover:bg-slate-50">My Local Records</Link></div>
          <p className="mt-4 text-xs text-slate-500">Your personal results are saved on this device only. Online verified leaderboards are not enabled in this first release.</p>
        </section>}
      </>}
    </div>
  </div>;
}
