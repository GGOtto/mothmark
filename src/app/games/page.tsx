// src/app/games/page.tsx
const games = [
  {
    id: "sealed-vault",
    title: "Sealed Vault",
    updatedAt: "Draft seed",
    rooms: 1,
  },
];

export default function GamesPage() {
  return (
    <main className="min-h-screen bg-[#11100e] text-[#eee8dc]">
      <div className="mx-auto max-w-5xl border-x border-[#2a2722]">
        <header className="flex items-center justify-between border-b border-[#2a2722] bg-[#15130f] px-6 py-4">
          <div>
            <a
              href="/"
              className="font-mono text-xs uppercase tracking-[0.18em] text-[#8e8678] hover:text-[#eee8dc]"
            >
              Mapwright
            </a>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Games
            </h1>
          </div>

          <button
            type="button"
            className="border border-[#d2b46f] bg-[#d2b46f] px-4 py-2 font-mono text-sm text-[#15130f] hover:bg-[#e4c77f]"
          >
            New game
          </button>
        </header>

        <section className="min-h-[calc(100vh-97px)] p-6">
          <div className="border border-[#2a2722] bg-[#15130f]">
            <div className="grid grid-cols-[1fr_120px_140px] border-b border-[#2a2722] px-4 py-3 font-mono text-xs uppercase tracking-[0.16em] text-[#8e8678]">
              <span>Name</span>
              <span>Rooms</span>
              <span>Status</span>
            </div>

            {games.map((game) => (
              <a
                key={game.id}
                href={`/games/${game.id}`}
                className="grid grid-cols-[1fr_120px_140px] px-4 py-4 text-sm hover:bg-[#1d1a15]"
              >
                <span className="font-medium text-[#f4eddf]">{game.title}</span>
                <span className="font-mono text-[#b9ad9b]">{game.rooms}</span>
                <span className="font-mono text-[#8e8678]">
                  {game.updatedAt}
                </span>
              </a>
            ))}
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-[#8e8678]">
            For now this is static. Next we’ll make the seed game open into the
            first editor screen.
          </p>
        </section>
      </div>
    </main>
  );
}
