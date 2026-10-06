/**
 * FEATURE ENGINEERING LAYER
 * ---------------------------------------------------------------------------
 * Pure functions: raw event log (array) -> behavioural feature vector (object).
 *
 * >>> FUTURE BACKEND INTEGRATION <<<
 * In production this module is re-implemented in Python (pandas) inside a
 * FastAPI service, e.g. `POST /api/sessions/{id}/features`, reading rows from
 * the PostgreSQL `events` table and writing to a `features` table. Keep the
 * feature names identical so the client and the trained models stay compatible.
 */

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r2 = (x) => +x.toFixed(2);
const byType = (events, type) => events.filter((e) => e.event === type);

// ===========================================================================
// Game 1 — Grocery Planning
// ===========================================================================
export function extractGroceryFeatures(events) {
  const end = byType(events, "GAME_END")[0] || {};
  const purchases = byType(events, "ITEM_PURCHASED");
  const dismissed = byType(events, "ITEM_DISMISSED");
  const switches = byType(events, "ITEM_SWITCHED");
  const removals = byType(events, "ITEM_REMOVED");
  const decisions = [...purchases, ...dismissed].sort((a, b) => a.t - b.t);

  // average decision time (first decision per requirement)
  const average_decision_time = mean(decisions.map((d) => d.decisionTime ?? 0));

  // comparison_count: distinct alternatives inspected beyond the first, per requirement
  const inspectedByReq = {};
  byType(events, "ITEM_INSPECTED").forEach((e) => {
    (inspectedByReq[e.requirementId] ??= new Set()).add(e.itemId);
  });
  const comparison_count = Object.values(inspectedByReq).reduce((s, set) => s + Math.max(0, set.size - 1), 0);

  // essential_first_ratio: share of the first N decisions that were essential entries
  const N = end.essentialsTotal ? Math.min(5, decisions.length) : 0;
  const essential_first_ratio = N ? decisions.slice(0, N).filter((d) => d.essential).length / N : 0;

  const finalBudget = end.finalBudget ?? end.initialBudget ?? 1;
  const budget_utilization = (end.finalSpending ?? 0) / Math.max(1, finalBudget);
  const remaining_budget_ratio = (end.budgetRemaining ?? 0) / Math.max(1, finalBudget);

  const plan_revision_count = switches.length + removals.length;
  const decision_switch_count = switches.length;

  // adaptation_time: mean time from an unexpected event to the first plan action.
  // Unanswered events are penalised with a 30s cap.
  const responses = byType(events, "EVENT_RESPONSE");
  const times = responses.map((r) => (r.responseTime == null ? 30 : Math.min(30, r.responseTime)));
  const adaptation_time = mean(times);

  // extra descriptive features used by the scoring layer
  const events_affecting_cart = byType(events, "UNEXPECTED_EVENT").filter((e) => e.affectsCart).length;
  const essentials_coverage = end.essentialsTotal ? end.essentialsFilled / end.essentialsTotal : 0;

  return {
    average_decision_time: r2(average_decision_time),
    comparison_count,
    essential_first_ratio: r2(essential_first_ratio),
    budget_utilization: r2(budget_utilization),
    remaining_budget_ratio: r2(remaining_budget_ratio),
    plan_revision_count,
    adaptation_time: r2(adaptation_time),
    decision_switch_count,
    // supplementary
    decisions_count: decisions.length,
    essentials_coverage: r2(essentials_coverage),
    average_quality: end.averageQuality ?? 0,
    over_budget: !!end.overBudget,
    abandoned_count: byType(events, "ITEM_ABANDONED").length,
    budget_exceeded_attempts: byType(events, "BUDGET_EXCEEDED_ATTEMPT").length,
    events_affecting_cart,
    total_inspections: byType(events, "ITEM_INSPECTED").length,
    final_spending: end.finalSpending ?? 0,
    budget_remaining: end.budgetRemaining ?? 0,
  };
}

// ===========================================================================
// Game 2 — The Watch
// ===========================================================================
export function extractWatchFeatures(events) {
  const end = byType(events, "GAME_END")[0] || {};
  const appeared = byType(events, "CONTACT_APPEARED");
  const detected = byType(events, "CONTACT_DETECTED");
  const responses = byType(events, "CONTACT_RESPONSE");
  const missed = byType(events, "CONTACT_MISSED");
  const changes = byType(events, "INSTRUCTION_CHANGE");
  const total = Math.max(1, appeared.length);

  const average_detection_time = mean(detected.map((d) => d.detectionTime));
  const average_decision_time = mean(responses.map((r) => r.responseTime));
  const detection_accuracy = responses.length ? responses.filter((r) => r.correct).length / responses.length : 0;

  const nonHigh = appeared.filter((c) => c.trueRisk !== "high").length;
  const falseAlerts = responses.filter((r) => r.falseAlert).length;
  const false_alarm_rate = falseAlerts / Math.max(1, nonHigh);
  const missed_event_rate = missed.length / total;
  const risky = appeared.filter((c) => c.trueRisk !== "low").length;
  const missed_risky = missed.filter((m) => m.trueRisk !== "low").length;
  const missedThreats = responses.filter((r) => r.missedThreat).length;

  // scan_coverage: for every 15s window, fraction of sectors observed (incl. the one already active)
  const scans = byType(events, "SECTOR_SCANNED").sort((a, b) => a.t - b.t);
  const duration = Math.max(15, Math.round(end.timeUsed ?? 120));
  const win = 15;
  const nWin = Math.max(1, Math.floor(duration / win));
  let current = null;
  let si = 0;
  const covs = [];
  for (let w = 0; w < nWin; w++) {
    const seen = new Set();
    while (si < scans.length && scans[si].t < w * win) { current = scans[si].sectorIndex; si++; }
    if (current != null) seen.add(current);
    let sj = si;
    while (sj < scans.length && scans[sj].t < (w + 1) * win) { seen.add(scans[sj].sectorIndex); sj++; }
    covs.push(seen.size / (end.sectors || 6));
  }
  const scan_coverage = mean(covs);

  const rule_compliance = responses.length ? responses.filter((r) => r.ruleCompliant).length / responses.length : 0;

  // adaptation: after each instruction change, time until first compliant response to an affected (medium) contact
  const adaptTimes = [];
  const afterChange = [];
  changes.forEach((c) => {
    const next = responses.find((r) => r.t >= c.t && r.trueRisk === "medium" && r.ruleCompliant && r.instructionIndex === c.toIndex);
    adaptTimes.push(next ? Math.min(30, next.t - c.t) : 30);
    responses.filter((r) => r.instructionIndex === c.toIndex && r.trueRisk === "medium").forEach((r) => afterChange.push(r));
  });
  const adaptation_time = mean(adaptTimes);
  const compliance_after_change = afterChange.length ? afterChange.filter((r) => r.ruleCompliant).length / afterChange.length : 0;

  const overAlerts = responses.filter((r) => r.selectedResponse === "ALERT" && r.ruleCompliant === false).length;
  const checks = responses.filter((r) => r.selectedResponse === "CHECK").length;

  return {
    average_detection_time: r2(average_detection_time),
    average_decision_time: r2(average_decision_time),
    detection_accuracy: r2(detection_accuracy),
    false_alarm_rate: r2(false_alarm_rate),
    missed_event_rate: r2(missed_event_rate),
    scan_coverage: r2(scan_coverage),
    rule_compliance: r2(rule_compliance),
    adaptation_time: r2(adaptation_time),
    // supplementary
    compliance_after_change: r2(compliance_after_change),
    contacts_total: appeared.length,
    contacts_handled: responses.length,
    contacts_missed: missed.length,
    missed_risky_rate: r2(missed_risky / Math.max(1, risky)),
    false_alerts: falseAlerts,
    missed_threats: missedThreats,
    over_alerts: overAlerts,
    check_share: r2(checks / Math.max(1, responses.length)),
    sectors_scanned: scans.length,
    instruction_changes: changes.length,
  };
}

export const extractFeatures = (gameId, events) =>
  gameId === "grocery" ? extractGroceryFeatures(events) : extractWatchFeatures(events);
