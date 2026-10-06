import { Play, Info } from "lucide-react";

/** Shared pre-game briefing card used by both simulations. */
export default function GameBrief({ icon: Icon, title, subtitle, rules, onStart }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <div className="card animate-fade-up p-8">
        <div className="mb-5 flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent/30 to-violet/30 text-accent">
            <Icon size={28} />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-white">{title}</h1>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>
        <ul className="mb-6 space-y-2.5">
          {rules.map((r) => (
            <li key={r} className="flex gap-3 text-sm text-slate-300">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {r}
            </li>
          ))}
        </ul>
        <div className="mb-6 flex gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
          <Info size={14} className="mt-0.5 shrink-0" />
          This is a research prototype. Your actions are recorded locally in your browser to demonstrate behavioural analysis.
        </div>
        <button id="start-game" className="btn-primary w-full" onClick={onStart}>
          <Play size={16} /> Begin simulation
        </button>
      </div>
    </div>
  );
}
