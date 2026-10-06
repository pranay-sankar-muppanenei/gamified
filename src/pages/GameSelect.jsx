import { ShoppingCart, Radar, Play, BarChart3, Timer, CheckCircle2 } from "lucide-react";
import { getLatestSession } from "../services/eventLogger";

const GAMES = [
  {
    id: "grocery", icon: ShoppingCart, name: "Grocery Planning", accent: "text-accent",
    tagline: "Resource allocation under changing conditions",
    skills: ["Planning", "Prioritisation", "Resource management", "Adaptability"],
    inspired: "Inspired by: household provisioning",
    duration: "≈ 2.5 min",
  },
  {
    id: "watch", icon: Radar, name: "The Watch", accent: "text-violet",
    tagline: "Safe monitoring with changing instructions",
    skills: ["Vigilance", "Situational awareness", "Risk behaviour", "Rule following"],
    inspired: "Inspired by: watchkeeping / surveillance",
    duration: "≈ 2 min",
  },
];

export default function GameSelect({ go }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="font-display text-3xl font-bold text-white">Choose a simulation</h1>
      <p className="mt-2 text-slate-400">Play one or both, then open the dashboard to see your behavioural analysis.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {GAMES.map((g) => {
          const done = getLatestSession(g.id);
          return (
            <article key={g.id} className="card group flex flex-col p-6 transition-all hover:-translate-y-1 hover:border-white/25">
              <div className="mb-4 flex items-center justify-between">
                <div className={`grid h-12 w-12 place-items-center rounded-xl bg-white/5 ${g.accent}`}><g.icon size={24} /></div>
                {done && <span className="chip !border-accent/40 !text-accent"><CheckCircle2 size={12} /> Completed</span>}
              </div>
              <h2 className="font-display text-xl font-semibold text-white">{g.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{g.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {g.skills.map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Timer size={12} /> {g.duration}</span>
                <span>{g.inspired}</span>
              </div>
              <button id={`play-${g.id}`} className="btn-primary mt-6" onClick={() => go(g.id)}>
                <Play size={15} /> {done ? "Play again" : "Play"}
              </button>
            </article>
          );
        })}
      </div>
      <div className="mt-8 text-center">
        <button id="open-dashboard" className="btn-ghost" onClick={() => go("results")}>
          <BarChart3 size={16} /> Open behavioural dashboard
        </button>
      </div>
    </div>
  );
}
