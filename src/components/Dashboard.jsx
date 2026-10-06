import { useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid,
} from "recharts";
import { ChevronDown, Activity, GitBranch, Database, Cpu, Brain, Search, Sparkles, LayoutDashboard, ArrowDown } from "lucide-react";

const COLORS = ["#6ee7d8", "#8b7cff", "#fbbf6a", "#ff7a90", "#5fb3ff", "#a3e635", "#f0abfc"];
const tip = { background: "#0a0f1f", border: "1px solid #27325c", borderRadius: 12, fontSize: 12, color: "#dfe6ff" };

export function ProfileCharts({ dims }) {
  const data = Object.values(dims).filter((d) => d.value != null).map((d) => ({ name: d.label, value: d.value }));
  const missing = Object.values(dims).filter((d) => d.value == null).map((d) => d.label);
  return (
    <div className="card p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-semibold text-white">Overall Behavioural Profile</h2>
        <span className="chip !border-amber/40 !text-amber">Prototype Behavioural Indicators</span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Indicative 0–100 heuristics — not clinically or psychologically validated personality scores.
        {missing.length > 0 && ` Not assessed in this view: ${missing.join(", ")}.`}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-72">
          <ResponsiveContainer>
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="#27325c" />
              <PolarAngleAxis dataKey="name" tick={{ fill: "#a8b3d6", fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="#6ee7d8" strokeWidth={2} fill="#6ee7d8" fillOpacity={0.28} />
              <Tooltip contentStyle={tip} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
              <CartesianGrid stroke="#1d2a4f" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#7f8bb5", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={118} tick={{ fill: "#a8b3d6", fontSize: 11 }} />
              <Tooltip contentStyle={tip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** Explainable-AI style view: weighted contribution of each feature to each indicator. */
export function ExplainPanel({ dims }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
        <Search size={16} className="text-violet" /> Explainable indicators
      </h2>
      <p className="mb-3 text-xs text-slate-500">How each feature contributes (a transparent stand-in for SHAP values in a future model).</p>
      <div className="space-y-2">
        {Object.values(dims).filter((d) => d.value != null).map((d) => (
          <div key={d.key} className="rounded-xl border border-white/10 bg-white/[0.03]">
            <button id={`explain-${d.key}`} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm" onClick={() => setOpen(open === d.key ? null : d.key)}>
              <span className="font-medium text-white">{d.label}</span>
              <span className="flex items-center gap-2 font-mono text-accent">{d.value}<ChevronDown size={14} className={`transition-transform ${open === d.key ? "rotate-180" : ""}`} /></span>
            </button>
            {open === d.key && (
              <div className="animate-slide-in space-y-1.5 px-3 pb-3">
                {d.components.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="w-52 truncate">{c.name} <span className="text-slate-600">· w={c.weight} · {c.game}</span></span>
                    <div className="h-1.5 flex-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-violet" style={{ width: `${c.score}%` }} /></div>
                    <span className="w-8 text-right font-mono">{c.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const KIND = {
  info: "bg-accent", good: "bg-emerald-400", revise: "bg-violet", warn: "bg-amber", muted: "bg-slate-500", end: "bg-rose",
};
export function Timeline({ rows }) {
  const [onlyKey, setOnlyKey] = useState(true);
  const shown = onlyKey ? rows.filter((r) => !["SECTOR_SCANNED", "ITEM_INSPECTED", "CONTACT_INSPECTED"].includes(r.event) || rows.length < 40) : rows;
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white"><Activity size={16} className="text-accent" /> Behavioural Timeline</h2>
        <button className="chip hover:bg-white/10" onClick={() => setOnlyKey(!onlyKey)}>{onlyKey ? "Condensed" : "All events"}</button>
      </div>
      <ol className="max-h-96 space-y-1 overflow-y-auto pr-2">
        {shown.map((r) => (
          <li key={r.id} className="flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
            <span className="w-12 shrink-0 font-mono text-xs text-slate-500">{r.time}</span>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND[r.kind]}`} />
            <span className="text-slate-200">{r.title}<span className="ml-2 text-xs text-slate-500">{r.detail}</span></span>
          </li>
        ))}
        {shown.length === 0 && <li className="text-sm text-slate-500">No events.</li>}
      </ol>
    </div>
  );
}

const pretty = (k) => k.replace(/_/g, " ");
const PCT = ["essential_first_ratio", "budget_utilization", "remaining_budget_ratio", "detection_accuracy", "false_alarm_rate", "missed_event_rate", "scan_coverage", "rule_compliance"];
const SEC = ["average_decision_time", "adaptation_time", "average_detection_time"];
const CORE = {
  grocery: ["average_decision_time", "comparison_count", "essential_first_ratio", "budget_utilization", "remaining_budget_ratio", "plan_revision_count", "adaptation_time", "decision_switch_count"],
  watch: ["average_detection_time", "average_decision_time", "detection_accuracy", "false_alarm_rate", "missed_event_rate", "scan_coverage", "rule_compliance", "adaptation_time"],
};
export function FeatureTable({ gameId, title, features }) {
  const fmtV = (k, v) => (PCT.includes(k) ? `${Math.round(v * 100)}%` : SEC.includes(k) ? `${v}s` : v);
  return (
    <div className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white"><Cpu size={16} className="text-violet" /> Extracted features · {title}</h2>
      <div className="grid grid-cols-2 gap-2">
        {CORE[gameId].map((k) => (
          <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{pretty(k)}</div>
            <div className="mt-1 font-display text-xl font-semibold text-white">{fmtV(k, features[k])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DecisionAnalysis({ title, cards }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 font-display text-lg font-semibold text-white">Decision Analysis · {title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="label">{label}</div>
            <div className="mt-1 font-display text-lg font-semibold text-white">{value}</div>
            {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AIInterpretation({ texts }) {
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet/20 blur-3xl" />
      <h2 className="relative mb-2 flex items-center gap-2 font-display text-lg font-semibold text-white"><Sparkles size={16} className="text-amber" /> AI Interpretation</h2>
      <div className="relative space-y-3 text-sm leading-relaxed text-slate-300">
        {texts.map((t, i) => <p key={i}>{t}</p>)}
      </div>
      <div className="relative mt-4 rounded-lg border border-amber/30 bg-amber/10 p-3 text-xs text-amber">
        Experimental prototype interpretation generated by a rule-based template. It is not a validated psychological diagnosis and must not be used for real-world decisions about individuals.
      </div>
    </div>
  );
}

const PIPE = [
  [Database, "Gameplay Data"], [Database, "Event Logs"], [Cpu, "Feature Engineering"], [Brain, "ML Model"],
  [GitBranch, "Behavioural Prediction"], [Search, "Explainable AI"], [LayoutDashboard, "Assessment Dashboard"],
];
export function FuturePipeline() {
  return (
    <div className="card p-5">
      <h2 className="mb-1 font-display text-lg font-semibold text-white">Future ML Pipeline</h2>
      <p className="mb-4 text-xs text-slate-500">Planned architecture. Nothing below is trained or running in this prototype.</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col items-center">
          {PIPE.map(([Icon, label], i) => (
            <div key={label} className="flex w-full max-w-xs flex-col items-center">
              <div className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white">
                <Icon size={16} className="text-accent" /> {label}
              </div>
              {i < PIPE.length - 1 && <ArrowDown size={16} className="my-1 text-slate-600" />}
            </div>
          ))}
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="label mb-1.5">Candidate models</div>
            <div className="flex flex-wrap gap-1.5">
              {["Logistic Regression", "Random Forest", "XGBoost", "Clustering", "LSTM", "Transformer sequence models"].map((m) => <span key={m} className="chip">{m}</span>)}
            </div>
          </div>
          <div>
            <div className="label mb-1.5">Explainability</div>
            <span className="chip !border-violet/40 !text-violet">SHAP</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
            <b className="text-slate-200">Backend plan:</b> FastAPI service receives batched events → PostgreSQL (<code>sessions</code>, <code>events</code> JSONB,{" "}
            <code>features</code>) → Python feature jobs → trained model + SHAP → JSON served to this dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventLogViewer({ events }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-5">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen(!open)} id="toggle-raw-log">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white"><Database size={16} className="text-accent" /> Raw event log ({events.length} events)</h2>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
          {events.slice(0, 200).map((e) => JSON.stringify(e)).join("\n")}
          {events.length > 200 ? `\n… ${events.length - 200} more (use Export JSON)` : ""}
        </pre>
      )}
    </div>
  );
}
