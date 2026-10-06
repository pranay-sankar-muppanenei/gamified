import { useEffect, useState } from "react";
import { Brain, ArrowLeft } from "lucide-react";
import Landing from "./pages/Landing";
import GameSelect from "./pages/GameSelect";
import Results from "./pages/Results";
import GroceryGame from "./games/grocery/GroceryGame";
import WatchGame from "./games/watch/WatchGame";
import { getPlayerId } from "./services/eventLogger";

const PAGES = ["landing", "select", "grocery", "watch", "results"];
const fromHash = () => {
  const p = window.location.hash.replace("#/", "");
  return PAGES.includes(p) ? p : "landing";
};

export default function App() {
  const [page, setPage] = useState(fromHash());
  const [playerId, setPlayerId] = useState(getPlayerId());
  const [lastGame, setLastGame] = useState(null);
  const [runKey, setRunKey] = useState(0); // remount games for a fresh run

  useEffect(() => {
    const on = () => setPage(fromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const go = (p) => {
    if (p === "grocery" || p === "watch") setRunKey((k) => k + 1);
    window.location.hash = `/${p}`;
    window.scrollTo(0, 0);
  };

  const inGame = page === "grocery" || page === "watch";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/70 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <button id="nav-home" onClick={() => go("landing")} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-violet text-ink-950">
              <Brain size={18} />
            </span>
            <span className="font-display text-sm font-semibold tracking-wide text-white">
              WGBA <span className="font-normal text-slate-400">· Research Prototype</span>
            </span>
          </button>
          <nav className="flex items-center gap-2 text-sm">
            <span className="chip hidden sm:inline-flex">Player {playerId}</span>
            {inGame ? (
              <button id="nav-back" className="btn-ghost !py-1.5" onClick={() => go("select")}>
                <ArrowLeft size={14} /> Exit
              </button>
            ) : (
              <>
                <button id="nav-games" className="btn-ghost !py-1.5" onClick={() => go("select")}>Games</button>
                <button id="nav-results" className="btn-ghost !py-1.5" onClick={() => go("results")}>Dashboard</button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {page === "landing" && <Landing go={go} playerId={playerId} setPlayerId={setPlayerId} />}
        {page === "select" && <GameSelect go={go} />}
        {page === "grocery" && (
          <GroceryGame key={runKey} onFinish={() => { setLastGame("grocery"); go("results"); }} />
        )}
        {page === "watch" && (
          <WatchGame key={runKey} onFinish={() => { setLastGame("watch"); go("results"); }} />
        )}
        {page === "results" && <Results go={go} playerId={playerId} lastGame={lastGame} />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-slate-500">
        Experimental research prototype · indicators are not psychologically validated · data stays in your browser.
      </footer>
    </div>
  );
}
