import Link from "next/link";
const games = [
  { href: "/games/caption-roulette", label: "Play Caption Roulette", title: "Caption Roulette", icon: "🎲", description: "Build a 100-point competition recap by keeping or gambling authentic KMEA caption scores.", status: "Playable now" },
  { href: "/games/championship-draft", label: "Learn about Championship Draft", title: "Championship Draft", icon: "🏆", description: "Draft historical performances into your own ultimate championship lineup.", status: "In development" },
];
export default function GamesPage() { return <main className="min-h-screen bg-[#F4F6F9]">
  <section className="bg-[#002144] px-6 py-16 text-white"><div className="mx-auto max-w-6xl">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E8AFC2]">The Marching Archives</p>
    <h1 className="mt-4 font-serif text-5xl font-bold">TMA Games</h1>
    <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">Make history your playing field. Explore real archived performances through original games built around documented competition results.</p>
  </div></section>
  <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
    <div className="grid gap-5 md:grid-cols-2">{games.map(game => <article key={game.href} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <span aria-hidden className="text-4xl">{game.icon}</span><p className="mt-5 text-xs font-bold uppercase tracking-widest text-[#861F41]">{game.status}</p>
      <h2 className="mt-2 font-serif text-3xl font-bold text-[#002144]">{game.title}</h2><p className="mt-3 min-h-20 text-sm leading-7 text-slate-600">{game.description}</p>
      <Link href={game.href} className="inline-flex rounded-lg bg-[#861F41] px-5 py-3 text-sm font-bold text-white hover:bg-[#701832]">{game.label} ↗</Link>
    </article>)}</div>
    <div className="flex flex-wrap gap-3"><Link href="/games/profile" className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-[#002144] hover:bg-slate-50">My Local Records</Link><Link href="/games/leaderboards" className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-[#002144] hover:bg-slate-50">Leaderboards</Link></div>
    <p className="text-sm text-slate-600">Games are based on published archive data. A game total combines historical scores and is never presented as an official competition result.</p>
  </div>
</main>; }
