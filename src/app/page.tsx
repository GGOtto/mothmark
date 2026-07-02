export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-neutral-400">
          Mapwright
        </p>

        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
          Build text adventures like maps, not spreadsheets.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
          Mapwright is a visual editor for designing interactive fiction worlds:
          rooms, exits, items, puzzles, and branching logic, all with a live
          playable preview.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="/games"
            className="rounded-full bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-300"
          >
            Open editor
          </a>

          <a
            href="/api/health"
            className="rounded-full border border-neutral-700 px-5 py-3 text-sm font-semibold text-neutral-100 transition hover:border-neutral-400"
          >
            Check API
          </a>
        </div>
      </section>
    </main>
  );
}
