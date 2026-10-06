import { useMemo, useState } from "react";
import { Download, RotateCcw, ShoppingCart, Radar, Layers } from "lucide-react";
import { getLatestSession, getEvents, exportAll, clearAllData } from "../services/eventLogger";
import { extractFeatures } from "../services/features";
import { scoreSession, interpretGrocery, interpretWatch, riskTendency, MODEL_INFO } from "../services/assessment";
import { buildTimeline } from "../services/timeline";
import {
  ProfileCharts, ExplainPanel, Timeline, FeatureTable, DecisionAnalysis, AIInterpretation, FuturePipeline, EventLogViewer,
} from "../components/Dashboard";

/**
 * Assessment dashboard. Pipeline shown here:
 *   events (eventLogger) -> features (features.js) -> indicators (assessment.js) -> charts
 * >>> With a backend, replace the three service calls in `load()` by one
 *     `GET /api/players/{id}/assessment` request. <<<
 */
function load(playerId) {
  const out = {};
  ["grocery", "watch"].forEach((gameId) => {
    const s = getLatestSession(gameId, playerId);
    if (!s) return;
    const events = getEvents(s.sessionId);
    out[gameId] = { session: s, events, features: extractFeatures(gameId, events), timeline: buildTimeline(gameId, events) };
  });
  return out;
}

const pct = (v) => `${Math.round(v * 100)}%`;

function groceryCards(f) {
  return [
    ["Avg decision time", `${f.average_decision_time}s`],
    ["Decisions made", f.decisions_count],
    ["Plan revisions", f.plan_revision_count, `${f.decision_switch_count} switches`],
    ["Risk-taking", f.budget_utilization > 0.95 ? "High" : f.budget_utilization > 0.7 ? "Moderate" : "Low", `budget used ${pct(f.budget_utilization)}`],
    ["Consistency", f.decision_switch_count <= 1 ? "High" : f.decision_switch_count <= 3 ? "Medium" : "Low", `${f.abandoned_count} abandoned`],
    ["Response to disruption", `${f.adaptation_time}s`, "mean time to first action"],
  ];
}
function watchCards(f) {
  return [
    ["Avg decision time", `${f.average_decision_time}s`],
    ["Decisions made", f.contacts_handled, `of ${f.contacts_total} contacts`],
    ["Rule changes handled", f.instruction_changes, `compliance after: ${pct(f.compliance_after_change)}`],
    ["Risk tendency", riskTendency(f).split(" (")[0], `${f.false_alerts} false alerts · ${f.contacts_missed} missed`],
    ["Consistency", pct(f.rule_compliance), "rule compliance"],
    ["Response to disruption", `${f.adaptation_time}s`, "to first compliant response"],
  ];
}

export default function Results({ go, playerId, lastGame }) {
  const [version, setVersion] = useState(0);
  const data = useMemo(() => load(playerId), [playerId, version]);
  const have = Object.keys(data);
  const [tab, setTab] = useState(lastGame && data[lastGame] ? lastGame : "combined");

  if (have.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <Layers size={36} className="mx-auto mb-4 text-accent" />
        <h1 className="font-display text-2xl font-bold text-white">No simulation data yet</h1>
        <p className="mt-2 text-slate-400">Play at least one game to generate behavioural event logs and see the dashboard.</p>
        <button className="btn-primary mt-6" onClick={() => go("select")}>Choose a game</button>
      </div>
    );
  }

  const active = tab === "combined" ? have : [tab].filter((g) => data[g]);
  const featuresByGame = Object.fromEntries(active.map((g) => [g, data[g].features]));
  const { dims } = scoreSession(featuresByGame);
  const events = active.flatMap((g) => data[g].events);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ ...exportAll(), features: Object.fromEntries(have.map((g) => [g, data[g].features])) }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wgba_${playerId}_export.json`;
    a.click();
  };

  const tabs = [
    ["combined", "Combined", Layers],
    ["grocery", "Grocery Planning", ShoppingCart],
    ["watch", "The Watch", Radar],
  ];

  const texts = active.map((g) => (g === "grocery" ? interpretGrocery(data[g].features) : interpretWatch(data[g].features)));
  const names = { grocery: "Grocery Planning", watch: "The Watch" };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="chip !border-amber/40 !text-amber">Experimental · {MODEL_INFO.name}</span>
          <h1 className="mt-2 font-display text-3xl font-bold text-white">Behavioural Assessment Dashboard</h1>
          <p className="text-sm text-slate-400">Participant {playerId} · latest session per game</p>
        </div>
        <div className="flex gap-2">
          <button id="export-json" className="btn-ghost" onClick={exportJson}><Download size={15} /> Export JSON</button>
          <button id="reset-data" className="btn-ghost" onClick={() => { if (confirm("Delete all locally stored sessions?")) { clearAllData(); setVersion((v) => v + 1); setTab("combined"); } }}>
            <RotateCcw size={15} /> Reset data
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label, Icon]) => {
          const enabled = id === "combined" || data[id];
          return (
            <button key={id} id={`tab-${id}`} disabled={!enabled} onClick={() => setTab(id)}
              className={`btn !py-2 ${tab === id ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
              <Icon size={14} /> {label}
            </button>
          );
        })}
        {have.length < 2 && (
          <button className="btn-ghost !py-2" onClick={() => go(have[0] === "grocery" ? "watch" : "grocery")}>
            Play {have[0] === "grocery" ? "The Watch" : "Grocery Planning"} for a fuller profile
          </button>
        )}
      </div>

      <ProfileCharts dims={dims} />

      <div className="grid gap-5 lg:grid-cols-2">
        <AIInterpretation texts={texts} />
        <ExplainPanel dims={dims} />
      </div>

      {active.map((g) => (
        <div key={g} className="grid gap-5 lg:grid-cols-2">
          <DecisionAnalysis title={names[g]} cards={g === "grocery" ? groceryCards(data[g].features) : watchCards(data[g].features)} />
          <FeatureTable gameId={g} title={names[g]} features={data[g].features} />
        </div>
      ))}

      <div className="grid gap-5 lg:grid-cols-2">
        {active.map((g) => <Timeline key={g} rows={data[g].timeline} />)}
      </div>

      <FuturePipeline />
      <EventLogViewer events={events} />
    </div>
  );
}
