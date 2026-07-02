export default function GamesPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← Back
        </a>

        <div className="mt-10">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-neutral-500">
            My Games
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Your adventures
          </h1>

          <p className="mt-4 max-w-2xl text-neutral-300">
            Sprint 1 starts here. Soon this page will show saved games and let
            you create a new adventure from the sealed-vault starter world.
          </p>

          <button
            type="button"
            className="mt-8 rounded-full bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-300"
          >
            Create game
          </button>
        </div>
      </div>
    </main>
  );
}
