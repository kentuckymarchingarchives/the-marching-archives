
import Image from "next/image";
import Link from "next/link";

const navigation = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Bands & Corps",
    href: "/bands",
  },
];

export default function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-white/10 bg-[#002144] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-4 md:px-8">
        {/* Website logo and identity */}
        <Link
          href="/"
          aria-label="The Marching Archives homepage"
          className="flex min-w-0 items-center gap-4"
        >
          <Image
            src="/tma-logo.png"
            alt="The Marching Archives logo"
            width={72}
            height={72}
            priority
            className="h-14 w-14 shrink-0 object-contain md:h-[72px] md:w-[72px]"
          />

          <div className="min-w-0">
            <span className="block font-serif text-lg font-bold tracking-wide md:text-2xl">
              The Marching Archives
            </span>

            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E0B4C2] md:text-xs">
              Preserving Marching History
            </span>
          </div>
        </Link>

        {/* Main navigation */}
        <nav
          aria-label="Main navigation"
          className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}

          <Link
            href="/staff/login"
            className="ml-1 rounded-lg bg-[#861F41] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#A02B52]"
          >
            Staff Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
