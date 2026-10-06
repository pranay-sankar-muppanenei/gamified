/** Turns raw events into human-readable timeline rows for the dashboard. */

const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

const UNEXPECTED_TEXT = {
  PRICE_INCREASE: (e) => `Price increased (${e.itemId}: $${e.oldPrice} → $${e.newPrice})`,
  ITEM_UNAVAILABLE: (e) => `Item became unavailable (${e.itemId})`,
  NEW_REQUIREMENT: () => "New requirement appeared",
  BUDGET_CHANGE: (e) => `Budget changed ($${e.oldBudget} → $${e.newBudget})`,
};

const MAP = {
  grocery: {
    ITEM_INSPECTED: (e) => ["Inspected product", `${e.itemName} · ${e.timeTaken}s`, "info"],
    ITEM_COMPARED: (e) => ["Compared alternative", `${e.itemName}`, "info"],
    ITEM_PURCHASED: (e) => ["Purchased item", `${e.itemName} · $${e.price} · decided in ${e.decisionTime}s`, "good"],
    ITEM_SWITCHED: (e) => ["Switched choice", `${e.itemName} (was ${e.fromItemId})`, "revise"],
    ITEM_REMOVED: (e) => ["Removed item", e.itemName, "revise"],
    ITEM_AUTO_REMOVED: (e) => ["Item removed by system", `${e.itemName} (${e.reason})`, "warn"],
    ITEM_DISMISSED: (e) => ["Skipped entry", e.requirementId, "muted"],
    ITEM_ABANDONED: (e) => ["Abandoned entry", `${e.requirementId} after ${e.alternativesInspected} inspection(s)`, "muted"],
    UNEXPECTED_EVENT: (e) => [UNEXPECTED_TEXT[e.eventType](e), "Unexpected event", "warn"],
    EVENT_RESPONSE: (e) =>
      e.unanswered ? ["No response to event", e.eventType, "warn"] : ["Revised plan", `${e.action} · ${e.responseTime}s after ${e.eventType}`, "revise"],
    BUDGET_EXCEEDED_ATTEMPT: (e) => ["Tried to exceed budget", e.itemName, "warn"],
    GAME_END: (e) => ["Simulation ended", `Spent $${e.finalSpending} · remaining $${e.budgetRemaining}`, "end"],
  },
  watch: {
    SECTOR_SCANNED: (e) => ["Scanned sector", e.sector, "muted"],
    CONTACT_DETECTED: (e) => ["Contact detected", `${e.contactId} ${e.contactType} · ${e.detectionTime}s after appearing`, "info"],
    CONTACT_INSPECTED: (e) => ["Inspected contact", `${e.contactId} · ${e.inspectionTime}s`, "info"],
    CONTACT_RESPONSE: (e) => [
      `Responded ${e.selectedResponse}`,
      `${e.contactId} (${e.trueRisk} risk) · ${e.ruleCompliant ? "rule-compliant" : "non-compliant"}${e.falseAlert ? " · false alert" : ""}`,
      e.ruleCompliant ? "good" : "warn",
    ],
    CONTACT_MISSED: (e) => ["Missed contact", `${e.contactId} (${e.trueRisk} risk) in ${e.sector}`, "warn"],
    INSTRUCTION_CHANGE: (e) => ["Instruction changed", e.newInstruction, "revise"],
    GAME_END: (e) => ["Watch ended", `${e.handled} handled · ${e.missed} missed`, "end"],
  },
};

export function buildTimeline(gameId, events) {
  const map = MAP[gameId];
  return events
    .filter((e) => map[e.event])
    .sort((a, b) => a.t - b.t)
    .map((e, i) => {
      const [title, detail, kind] = map[e.event](e);
      return { id: `${e.sessionId}-${i}`, time: fmt(e.t), t: e.t, title, detail, kind, event: e.event };
    });
}
