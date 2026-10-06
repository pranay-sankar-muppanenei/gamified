/**
 * Scenario generator for Game 2 — The Watch.
 * A safe, abstract monitoring task: no weapons, combat or tactics.
 * Contacts are neutral objects (vessels, buoys, signals) and the "response"
 * is a triage decision: ALLOW / CHECK / ALERT.
 */

export const WATCH_CONFIG = {
  duration: 120,
  sectors: ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"],
  seed: 20240607, // same scenario for every participant (research comparability)
};

export const INSTRUCTIONS = [
  { index: 0, t: 0, text: "Alert only when there is strong evidence of a problem." },
  { index: 1, t: 40, text: "Due to a new situation, suspicious medium-risk contacts should now be CHECKED." },
  { index: 2, t: 80, text: "Heightened caution: only clearly harmless contacts may be allowed. Medium and high risk need CHECK or ALERT." },
];

export const instructionAt = (t) => [...INSTRUCTIONS].reverse().find((i) => t >= i.t);

/**
 * Ideal response + allowed responses per instruction & true risk.
 * Used for accuracy and rule-compliance (never shown to the player live).
 */
export function evaluateResponse(risk, instructionIndex, response) {
  const ideal = risk === "high" ? "ALERT" : risk === "low" ? "ALLOW" : instructionIndex === 0 ? "ALLOW" : "CHECK";
  let allowed;
  if (risk === "low") allowed = ["ALLOW"];
  else if (risk === "high") allowed = ["ALERT"];
  else if (instructionIndex === 0) allowed = ["ALLOW", "CHECK"];
  else if (instructionIndex === 1) allowed = ["CHECK"];
  else allowed = ["CHECK", "ALERT"];
  const compliant = allowed.includes(response);
  const correct = response === ideal;
  // false alert: ALERT where the ideal action is not ALERT; over-alerting beyond the rule
  const falseAlert = response === "ALERT" && ideal !== "ALERT" && !(instructionIndex === 2 && risk === "medium");
  const missedThreat = risk === "high" && response === "ALLOW";
  return { ideal, compliant, correct, falseAlert, missedThreat };
}

const TYPES = ["Cargo Vessel", "Survey Buoy", "Unmarked Craft", "Relay Beacon", "Weather Cell", "Drifting Object"];
const CUE_BANK = {
  id: ["Verified identity", "Partial identity", "No identity broadcast"],
  move: ["Steady, predictable course", "Irregular course changes", "Erratic, evasive path"],
  signal: ["Standard transmission", "Intermittent signal", "Masked / spoofed signal"],
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the whole contact schedule deterministically. Time pressure rises over time. */
export function generateContacts() {
  const rnd = mulberry32(WATCH_CONFIG.seed);
  const contacts = [];
  let t = 3;
  let n = 0;
  while (t < WATCH_CONFIG.duration - 8) {
    const progress = t / WATCH_CONFIG.duration;
    const interval = 5.2 - 2.8 * progress; // 5.2s -> 2.4s
    const lifetime = 18 - 9 * progress; // 18s -> 9s
    const r = rnd();
    const risk = r < 0.45 ? "low" : r < 0.78 ? "medium" : "high";
    const level = { low: 0, medium: 1, high: 2 }[risk];
    const noisy = () => Math.max(0, Math.min(2, level + (rnd() < 0.22 ? (rnd() < 0.5 ? -1 : 1) : 0)));
    const center = { low: 17, medium: 50, high: 83 }[risk];
    const score = Math.round(Math.max(3, Math.min(97, center + (rnd() - 0.5) * 28)));
    const sector = Math.floor(rnd() * WATCH_CONFIG.sectors.length);
    contacts.push({
      id: `C${String(++n).padStart(2, "0")}`,
      type: TYPES[Math.floor(rnd() * TYPES.length)],
      risk, sector, spawnT: +t.toFixed(2), lifetime: +lifetime.toFixed(2),
      score,
      cues: [CUE_BANK.id[noisy()], CUE_BANK.move[noisy()], CUE_BANK.signal[noisy()]],
      angle: rnd(), radius: 0.3 + rnd() * 0.6,
    });
    t += interval * (0.8 + rnd() * 0.4);
  }
  return contacts;
}
