import { ArrowRight, ShoppingCart, Radar, Database, Cpu, LineChart, Layers, FlaskConical } from "lucide-react";
import { setPlayerId as persistPlayerId } from "../services/eventLogger";

const steps = [
  { icon: Layers, title: "Gamified work", text: "Real-world work is abstracted into decontextualised simulations." },
  { icon: Database, title: "Event logging", text: "Every action becomes a timestamped behavioural event." },
  { icon: Cpu, title: "Feature engineering", text: "Raw logs are converted into interpretable behavioural features." },
  { icon: LineChart, title: "AI assessment", text: "An explainable prototype model produces indicative profiles." },
];

export default function Landing({ go, playerId, setPlayerId }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-16">
      <section className="animate-fade-up text-center">
        <span className="chip mb-5 !border-accent/40 !text-accent"><FlaskConical size={12} /> Research prototype</span>
        <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-6xl">
          Work Gamification for
          <br />
          <span className="bg-gradient-to-r from-accent via-violet to-rose bg-clip-text text-transparent">Behavioural Assessment</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400 sm:text-lg">
          Explore how everyday work can be turned into decontextualised game simulations, how player behaviour is recorded as event
          logs, and how those logs can feed an AI-style behavioural assessment.
        </p>

        <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 sm:flex-row">
          <label className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm">
            <span className="label">Player ID</span>
            <input
              id="player-id"
              value={playerId}
              onChange={(e) => { setPlayerId(e.target.value); persistPlayerId(e.target.value); }}
              className="w-full bg-transparent font-mono text-white outline-none"
              maxLength={12}
            />
          </label>
          <button id="start-button" className="btn-primary w-full whitespace-nowrap sm:w-auto" onClick={() => go("select")}>
            Start <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-2 text-accent"><ShoppingCart size={18} /> <span className="label !text-accent">Game 1</span></div>
          <h2 className="font-display text-xl font-semibold text-white">Grocery Planning</h2>
          <p className="mt-2 text-sm text-slate-400">
            Inspired by household provisioning. Measures planning, prioritisation, resource management and adaptability.
          </p>
          <p className="mt-4 font-mono text-xs text-slate-500">Mother’s work → Resource allocation → Planning / Adaptability</p>
        </div>
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-2 text-violet"><Radar size={18} /> <span className="label !text-violet">Game 2</span></div>
          <h2 className="font-display text-xl font-semibold text-white">The Watch</h2>
          <p className="mt-2 text-sm text-slate-400">
            Inspired by watchkeeping. A safe monitoring task measuring vigilance, rule following and risk behaviour.
          </p>
          <p className="mt-4 font-mono text-xs text-slate-500">Watchkeeping → Situational awareness → Vigilance / Decisions</p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="label mb-4 text-center">How the pipeline works</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="card p-5 transition-transform hover:-translate-y-1">
              <div className="mb-3 flex items-center justify-between">
                <s.icon className="text-accent" size={20} />
                <span className="font-mono text-xs text-slate-600">0{i + 1}</span>
              </div>
              <div className="font-semibold text-white">{s.title}</div>
              <p className="mt-1 text-sm text-slate-400">{s.text}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-slate-500">
          The games are decontextualised: no prior experience of household work or watchkeeping is needed. Outputs are indicative
          prototype indicators only — not clinically or psychologically validated.
        </p>
      </section>
    </div>
  );
}
