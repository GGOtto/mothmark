// src/app/page.tsx
export default function Home() {
  return (
    <main className="min-h-screen bg-[#11100e] text-[#eee8dc]">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-0 border-x border-[#2a2722] lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[#2a2722] bg-[#15130f] p-6 lg:border-b-0 lg:border-r">
          <a href="/" className="block">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#9c9384]">
              Mapwright
            </p>
            <p className="mt-3 text-sm leading-6 text-[#c7bcaa]">
              A room-and-command editor for text adventures.
            </p>
          </a>

          <nav className="mt-10 space-y-2 font-mono text-sm">
            <a
              href="/games"
              className="block border-l border-[#d2b46f] py-1 pl-3 text-[#eee8dc]"
            >
              Games
            </a>
            <a
              href="/api/health"
              className="block border-l border-transparent py-1 pl-3 text-[#8e8678] hover:text-[#eee8dc]"
            >
              API health
            </a>
          </nav>
        </aside>

        <section className="p-6 sm:p-10">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8e8678]">
              Sprint 1
            </p>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[#f4eddf] sm:text-5xl">
              Draw the map. Test the room. Keep writing.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-[#c7bcaa]">
              Mapwright is a small, practical editor for building parser-style
              adventures. Rooms, exits, descriptions, and a live command preview
              stay on the same workbench.
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border border-[#2a2722] bg-[#15130f]">
              <div className="flex items-center justify-between border-b border-[#2a2722] px-4 py-3">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#9c9384]">
                  Draft map
                </h2>
                <span className="font-mono text-xs text-[#6f675d]">
                  sealed-vault
                </span>
              </div>

              <div className="relative h-80 overflow-hidden bg-[linear-gradient(#242019_1px,transparent_1px),linear-gradient(90deg,#242019_1px,transparent_1px)] bg-[size:32px_32px] p-8">
                <div className="w-56 border border-[#6f5f39] bg-[#1d1a15] p-4 shadow-[8px_8px_0_#0c0b09]">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#d2b46f]">
                    Room 001
                  </p>
                  <h3 className="mt-3 text-xl font-medium text-[#f4eddf]">
                    Sealed Vault
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#b9ad9b]">
                    Dust hangs in the stale air. A stone door waits to the east.
                  </p>
                </div>

                <div className="absolute left-[296px] top-[126px] h-px w-24 bg-[#6f5f39]" />
                <div className="absolute left-[392px] top-[118px] font-mono text-xs text-[#8e8678]">
                  east
                </div>
              </div>
            </div>

            <div className="border border-[#2a2722] bg-[#15130f]">
              <div className="border-b border-[#2a2722] px-4 py-3">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#9c9384]">
                  Preview
                </h2>
              </div>

              <div className="p-4 font-mono text-sm leading-7">
                <p className="text-[#f4eddf]">Sealed Vault</p>
                <p className="mt-3 text-[#b9ad9b]">
                  Dust hangs in the stale air. A stone door waits to the east.
                </p>

                <div className="mt-8 border-t border-[#2a2722] pt-4">
                  <p>
                    <span className="text-[#d2b46f]">&gt;</span>{" "}
                    <span className="text-[#eee8dc]">go east</span>
                  </p>
                  <p className="mt-2 text-[#8e8678]">
                    The door does not open yet.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <a
              href="/games"
              className="border border-[#d2b46f] bg-[#d2b46f] px-4 py-2 font-mono text-sm text-[#15130f] hover:bg-[#e4c77f]"
            >
              Open games
            </a>
            <a
              href="/api/health"
              className="border border-[#3a352d] px-4 py-2 font-mono text-sm text-[#c7bcaa] hover:border-[#8e8678] hover:text-[#f4eddf]"
            >
              Check API
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
