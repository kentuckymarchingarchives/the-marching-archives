export type Slot = { key: string; name: string; maximum: number; multiplier: number };
export type Candidate = {
  key: string;
  slotKey: string;
  band: string;
  bandSlug: string | null;
  competition: string;
  year: number;
  sourceUrl: string | null;
  round: string;
  classification: string | null;
  score: number;
  maximum: number;
  multiplier: number;
};
export type GamePool = {
  slots: Slot[];
  candidates: Candidate[];
  message?: string | null;
  organization?: string;
};

export function normalizeGamePool(data: unknown): GamePool {
  if (!data || typeof data !== "object") return { slots: [], candidates: [], message: "No eligible records available." };
  const obj = data as Record<string, unknown>;
  const slots = Array.isArray(obj.slots) ? obj.slots : [];
  const candidates = Array.isArray(obj.candidates) ? obj.candidates : [];
  const cleanSlots: Slot[] = slots.map((v: Record<string, unknown>) => ({
    key: String(v.key ?? ""), name: String(v.name ?? ""),
    maximum: Number(v.maximum), multiplier: Number(v.multiplier),
  })).filter(s => s.key && s.name && Number.isFinite(s.maximum) && s.maximum > 0 && Number.isFinite(s.multiplier) && s.multiplier > 0);
  const keys = new Set(cleanSlots.map(s => s.key));
  const cleanCandidates: Candidate[] = candidates.map((v: Record<string, unknown>) => ({
    key: String(v.key ?? ""), slotKey: String(v.slotKey ?? ""),
    band: String(v.band ?? ""), bandSlug: v.bandSlug ? String(v.bandSlug) : null,
    competition: String(v.competition ?? ""), year: Number(v.year),
    sourceUrl: typeof v.sourceUrl === "string" ? v.sourceUrl : null,
    round: String(v.round ?? ""), classification: v.classification ? String(v.classification) : null,
    score: Number(v.score), maximum: Number(v.maximum), multiplier: Number(v.multiplier),
  })).filter(c => keys.has(c.slotKey) && c.key && c.band && c.competition && c.year >= 1996 && Number.isFinite(c.score) && c.score >= 0 && c.score <= c.maximum);
  const valid = cleanSlots.length >= 3 && cleanSlots.length <= 12 &&
    Math.abs(cleanSlots.reduce((sum, s) => sum + s.maximum * s.multiplier, 0) - 100) < 0.001 &&
    cleanSlots.every(s => cleanCandidates.filter(c => c.slotKey === s.key).length >= 2);
  return valid ? { slots: cleanSlots, candidates: cleanCandidates } : {
    slots: [], candidates: [], message: typeof obj.message === "string" ? obj.message : "This historical format needs at least two caption performances per slot before it can be played.",
  };
}

export function points(candidate: Candidate): number {
  return Math.round(candidate.score * candidate.multiplier * 1000) / 1000;
}
export function fmt(value: number): string { return value.toFixed(3); }

// Stable, deterministic selections for daily mode (same day, same pool).
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = 2166136261;
  for (const char of seed) { state ^= char.charCodeAt(0); state = Math.imul(state, 16777619); }
  const rng = () => {
    state += 0x6D2B79F5;
    let x = state;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
