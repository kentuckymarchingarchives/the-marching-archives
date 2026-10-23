
export default function HomePage() {
  return (
    <main className="bg-[#F4F6F9]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#002144] text-white">
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-[#861F41]/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
          <p className="mb-5 text-xs font-extrabold uppercase tracking-[0.3em] text-[#E0B4C2]">
            The Marching Archives
          </p>

          <h1 className="max-w-4xl font-serif text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Every Performance.
            <br />
            Every Competition.
            <br />
            <span className="text-[#DCA6B7]">
              Every Legacy.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300">
            A growing historical archive dedicated to preserving
            marching band and drum corps competition results,
            performances, placements, and the organizations
            that shaped marching history.
          </p>

          <div className="mt-10">
            <span className="inline-block rounded-lg bg-[#861F41] px-6 py-3 text-sm font-bold text-white">
              Historical Archive in Development
            </span>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#861F41]">
              Our Mission
            </p>

            <h2 className="mt-4 font-serif text-4xl font-bold text-[#002144]">
              Preserving the History of the Marching Arts
            </h2>

            <p className="mt-6 text-base leading-8 text-slate-600">
              The Marching Archives is dedicated to documenting
              historical marching band and drum corps competition
              records in a searchable and organized format.
            </p>

            <p className="mt-4 text-base leading-8 text-slate-600">
              Our goal is to help performers, educators, alumni,
              researchers, and fans explore decades of competitive
              marching history through reliable historical records.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-xl font-bold text-[#002144]">
              What We're Building
            </h3>

            <div className="mt-6 space-y-5">
              {[
                {
                  title: "Competition Results",
                  description:
                    "Historical scores, placements, captions, and championship rounds.",
                },
                {
                  title: "Band & Corps Profiles",
                  description:
                    "Locations, historical names, and competitive histories.",
                },
                {
                  title: "Historical Statistics",
                  description:
                    "Research-friendly records and statistics across multiple seasons.",
                },
                {
                  title: "Verified Sources",
                  description:
                    "Links to supporting sources and documented competition information.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="border-l-4 border-[#861F41] pl-5"
                >
                  <h4 className="font-bold text-[#002144]">
                    {item.title}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Organizations */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#861F41]">
              Competition Coverage
            </p>

            <h2 className="mt-4 font-serif text-4xl font-bold text-[#002144]">
              Organizations We're Documenting
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              The archive is being developed to support
              competition records from these organizations.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                code: "KMEA",
                name: "Kentucky Music Educators Association",
              },
              {
                code: "MSBA",
                name: "Mid-States Band Association",
              },
              {
                code: "BOA",
                name: "Bands of America",
              },
              {
                code: "DCI",
                name: "Drum Corps International",
              },
            ].map((organization) => (
              <div
                key={organization.code}
                className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7 text-center transition hover:border-[#861F41]"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#002144] text-lg font-black text-white">
                  {organization.code}
                </div>

                <h3 className="mt-5 font-bold text-[#002144]">
                  {organization.name}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Development Notice */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="rounded-2xl bg-[#002144] px-8 py-12 text-center text-white">
          <h2 className="font-serif text-3xl font-bold">
            A New Historical Resource Is Coming
          </h2>

          <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-300">
            The Marching Archives is currently under development.
            Competition results, band profiles, and additional
            historical records will become available as the
            archive grows.
          </p>
        </div>
      </section>
    </main>
  );
}
