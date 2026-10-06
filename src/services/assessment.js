/**
 * AI ASSESSMENT PROTOTYPE  (ML layer — rule-based baseline)
 * ---------------------------------------------------------------------------
 * Converts behavioural features into "Prototype Behavioural Indicators"
 * (0–100). These are transparent weighted heuristics. They are NOT validated
 * psychological, clinical or personality scores.
 *
 * >>> FUTURE ML INTEGRATION <<<
 * Replace `scoreSession()` with a call to a trained model served by FastAPI:
 *
 *   POST /api/assess  { features: {...}, game_id }  ->  { indicators, shap_values }
 *
 * Candidate models: Logistic Regression / Random Forest / XGBoost (tabular
 * features), clustering (behavioural archetypes), LSTM / Transformer sequence
 * models on raw event streams, with SHAP for explainability. The `components`
 * array returned per indicator mirrors a SHAP-style "feature contribution" view.
 */

export const MODEL_INFO = {
  name: "Rule-based baseline v0.1",
  type: "Weighted heuristic (client-side)",
  validated: false,
};

const clamp = (x) => Math.max(0, Math.min(1, x));
const up = (x, lo, hi) => clamp((x - lo) / (hi - lo)); // higher is better
const down = (x, lo, hi) => 1 - up(x, lo, hi); // lower is better

/** weighted sum of named components -> {value 0-100, components} */
function combine(parts) {
  const sumW = parts.reduce((s, p) => s + p.weight, 0);
  const value = Math.round((parts.reduce((s, p) => s + p.weight * p.value, 0) / sumW) * 100);
  return {
    value,
    components: parts.map((p) => ({ name: p.name, weight: p.weight, score: Math.round(p.value * 100) })),
  };
}

// ---------------------------------------------------------------------------
// Grocery indicators
// ---------------------------------------------------------------------------
function groceryIndicators(f) {
  // budget discipline: best around 70–95% utilisation, penalise overspend & hoarding of budget
  const budgetDiscipline = f.over_budget ? 0.2 : clamp(1 - Math.abs(f.budget_utilization - 0.85) / 0.6);
  const consistency = down(f.decision_switch_count, 0, 5);
  const speed = down(f.average_decision_time, 3, 25);
  const revisionEfficiency = f.events_affecting_cart > 0 ? up(Math.min(f.plan_revision_count, 3), 0, 2) : 0.6;

  return {
    planning: combine([
      { name: "comparison_count", weight: 0.3, value: up(f.comparison_count, 0, 8) },
      { name: "essential_first_ratio", weight: 0.3, value: f.essential_first_ratio },
      { name: "decision consistency", weight: 0.2, value: consistency },
      { name: "budget management", weight: 0.2, value: budgetDiscipline },
    ]),
    resource: combine([
      { name: "budget discipline", weight: 0.45, value: budgetDiscipline },
      { name: "essentials coverage", weight: 0.3, value: f.essentials_coverage },
      { name: "quality for spend", weight: 0.25, value: up(f.average_quality, 2, 4.5) },
    ]),
    decision: combine([
      { name: "decision speed", weight: 0.4, value: speed },
      { name: "comparison_count", weight: 0.3, value: up(f.comparison_count, 0, 8) },
      { name: "consistency", weight: 0.3, value: consistency },
    ]),
    adaptability: combine([
      { name: "adaptation_time", weight: 0.6, value: down(f.adaptation_time, 3, 25) },
      { name: "plan revision efficiency", weight: 0.4, value: revisionEfficiency },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Watch indicators
// ---------------------------------------------------------------------------
function watchIndicators(f) {
  const speed = down(f.average_detection_time, 2, 14);
  const decSpeed = down(f.average_decision_time, 1.5, 10);
  const calibration = clamp(1 - (f.false_alarm_rate * 1.2 + f.missed_risky_rate * 1.0 + f.missed_threats * 0.05));
  return {
    vigilance: combine([
      { name: "detection_accuracy", weight: 0.35, value: f.detection_accuracy },
      { name: "scan_coverage", weight: 0.35, value: f.scan_coverage },
      { name: "detection speed", weight: 0.3, value: speed },
    ]),
    attention: combine([
      { name: "scan_coverage", weight: 0.5, value: f.scan_coverage },
      { name: "1 − missed_event_rate", weight: 0.5, value: 1 - f.missed_event_rate },
    ]),
    decision: combine([
      { name: "detection_accuracy", weight: 0.5, value: f.detection_accuracy },
      { name: "rule_compliance", weight: 0.3, value: f.rule_compliance },
      { name: "decision speed", weight: 0.2, value: decSpeed },
    ]),
    adaptability: combine([
      { name: "compliance after instruction change", weight: 0.6, value: f.compliance_after_change },
      { name: "adaptation_time", weight: 0.4, value: down(f.adaptation_time, 3, 30) },
    ]),
    risk: combine([
      { name: "1 − false_alarm_rate", weight: 0.35, value: 1 - f.false_alarm_rate },
      { name: "1 − missed risky events", weight: 0.4, value: 1 - f.missed_risky_rate },
      { name: "alert calibration", weight: 0.25, value: calibration },
    ]),
  };
}

/**
 * Risk tendency label from Watch behaviour (descriptive, not diagnostic).
 */
export function riskTendency(f) {
  if (!f) return null;
  const overCaution = f.false_alarm_rate + f.over_alerts * 0.03;
  const underReaction = f.missed_risky_rate + f.missed_threats * 0.08;
  if (overCaution - underReaction > 0.12) return "Cautious (tends to over-alert)";
  if (underReaction - overCaution > 0.12) return "Risk-tolerant (tends to under-react)";
  return "Balanced";
}

const LABELS = {
  planning: "Planning",
  decision: "Decision Making",
  adaptability: "Adaptability",
  resource: "Resource Management",
  vigilance: "Vigilance",
  risk: "Risk Behaviour",
  attention: "Attention",
};
export const INDICATOR_LABELS = LABELS;

/**
 * Score one or both games. Dimensions that exist in both games (Decision
 * Making, Adaptability) are averaged. Dimensions with no data are `null`.
 * @param {{grocery?: object, watch?: object}} featuresByGame
 */
export function scoreSession(featuresByGame) {
  const parts = {};
  if (featuresByGame.grocery) parts.grocery = groceryIndicators(featuresByGame.grocery);
  if (featuresByGame.watch) parts.watch = watchIndicators(featuresByGame.watch);

  const dims = {};
  Object.keys(LABELS).forEach((k) => {
    const srcs = ["grocery", "watch"].filter((g) => parts[g]?.[k]);
    dims[k] = srcs.length
      ? {
          key: k,
          label: LABELS[k],
          value: Math.round(srcs.reduce((s, g) => s + parts[g][k].value, 0) / srcs.length),
          sources: srcs,
          components: srcs.flatMap((g) => parts[g][k].components.map((c) => ({ ...c, game: g }))),
        }
      : { key: k, label: LABELS[k], value: null, sources: [], components: [] };
  });
  return { dims, parts };
}

// ---------------------------------------------------------------------------
// Natural-language interpretation (template-based "AI" explanation)
// ---------------------------------------------------------------------------
const level = (v, lo, hi, words) => (v < lo ? words[0] : v < hi ? words[1] : words[2]);

export function interpretGrocery(f) {
  if (!f) return null;
  const s = [];
  s.push(
    `During the planning simulation, the participant ${level(f.comparison_count, 2, 5, [
      "mostly committed to the first option they inspected",
      "compared some alternatives before committing to a purchase",
      "generally compared multiple alternatives before committing to a purchase",
    ])}`
    + ` and ${level(f.average_decision_time, 6, 14, ["decided quickly", "took a moderate amount of time per decision", "deliberated for a long time on decisions"])} (avg ${f.average_decision_time}s).`,
  );
  s.push(
    f.over_budget
      ? "The final cart exceeded the available budget."
      : `They ${level(f.remaining_budget_ratio, 0.1, 0.3, ["spent almost the entire budget", "maintained a moderate budget reserve", "kept a large budget reserve"])} (${Math.round(f.remaining_budget_ratio * 100)}% remaining).`,
  );
  s.push(
    f.essentials_coverage < 1
      ? `Not every essential entry was filled (${Math.round(f.essentials_coverage * 100)}% coverage).`
      : "All essential requirements were covered.",
  );
  s.push(
    `Following unexpected changes, the participant revised their plan ${level(f.adaptation_time, 8, 16, ["quickly", "relatively quickly", "slowly"])}`
    + ` (mean response ${f.adaptation_time}s, ${f.plan_revision_count} revision${f.plan_revision_count === 1 ? "" : "s"}).`,
  );
  return s.join(" ");
}

export function interpretWatch(f) {
  if (!f) return null;
  const s = [];
  s.push(
    `In the monitoring simulation the participant handled ${f.contacts_handled} of ${f.contacts_total} contacts with ${Math.round(f.detection_accuracy * 100)}% matching the ideal response`
    + ` and covered ${Math.round(f.scan_coverage * 100)}% of sectors per observation window.`,
  );
  s.push(
    `${f.false_alerts} false alert${f.false_alerts === 1 ? "" : "s"} and ${f.contacts_missed} missed contact${f.contacts_missed === 1 ? "" : "s"} were recorded, suggesting a ${riskTendency(f).toLowerCase()} response style.`,
  );
  s.push(
    `After the instruction changes, rule compliance on affected contacts was ${Math.round(f.compliance_after_change * 100)}%`
    + ` and the first compliant response came after ${f.adaptation_time}s on average, indicating ${level(f.compliance_after_change, 0.4, 0.75, ["slow", "moderate", "fast"])} adaptation to new rules.`,
  );
  return s.join(" ");
}
