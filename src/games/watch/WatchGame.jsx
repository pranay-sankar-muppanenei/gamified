import { useEffect, useRef, useState } from "react";
import { Radar, Eye, Check, ShieldQuestion, Siren, Clock, Megaphone, Crosshair } from "lucide-react";
import { createSessionLogger } from "../../services/eventLogger";
import { WATCH_CONFIG, INSTRUCTIONS, instructionAt, evaluateResponse, generateContacts } from "./scenario";
import GameBrief from "../../components/GameBrief";

/**
 * Game 2 — The Watch
 * A safe monitoring simulation. The player rotates their observation between
 * sectors (only the observed sector reveals contacts), inspects contacts and
 * triages them with ALLOW / CHECK / ALERT while instructions change.
 */
export default function WatchGame({ onFinish }) {
  const [started, setStarted] = useState(false);
  if (!started) {
    return (
      <GameBrief
        icon={Radar}
        title="The Watch"
        subtitle="Monitoring, vigilance and rule-following under time pressure"
        rules={[
          `You monitor six sectors for ${WATCH_CONFIG.duration} seconds. Only the sector you are observing shows its contacts.`,
          "Click a sector to observe it, then click a contact to inspect its evidence.",
          "Respond: ALLOW (no action), CHECK (request a closer review) or ALERT (raise an alarm).",
          "Contacts leave after a while, and the pace increases. Unhandled contacts count as missed.",
          "Your standing instruction can change during the session — follow the current one.",
          "This is an abstract monitoring task: no weapons, combat or tactics are involved.",
        ]}
        onStart={() => setStarted(true)}
      />
    );
  }
  return <WatchPlay onFinish={onFinish} />;
}

const polar = (angleDeg, r) => {
  const a = (angleDeg * Math.PI) / 180;
  return [200 + r * Math.cos(a), 200 + r * Math.sin(a)];
};
const wedgePath = (i, n) => {
  const step = 360 / n;
  const a0 = -90 + i * step, a1 = a0 + step;
  const [x0, y0] = polar(a0, 185), [x1, y1] = polar(a1, 185);
  return `M200 200 L${x0} ${y0} A185 185 0 0 1 ${x1} ${y1} Z`;
};

function WatchPlay({ onFinish }) {
  const [, tick] = useState(0);
  const rerender = () => tick((n) => n + 1);
  const loggerRef = useRef(null);
  if (!loggerRef.current) loggerRef.current = createSessionLogger("watch");
  const logger = loggerRef.current;

  const gRef = useRef(null);
  if (!gRef.current) {
    gRef.current = {
      schedule: generateContacts(),
      spawned: [], // live contact state
      spawnIdx: 0,
      activeSector: null,
      lastScan: Object.fromEntries(WATCH_CONFIG.sectors.map((_, i) => [i, null])),
      inspect: null, // { id, start }
      instruction: INSTRUCTIONS[0],
      lastChangeT: null,
      finished: false,
      elapsed: 0,
      toast: null,
      counts: { handled: 0, missed: 0 },
    };
  }
  const g = gRef.current;
  const nSectors = WATCH_CONFIG.sectors.length;

  const contactById = (id) => g.spawned.find((c) => c.id === id);
  const instrLog = () => ({ instruction: g.instruction.text, instructionIndex: g.instruction.index });

  const endInspect = () => {
    if (!g.inspect) return;
    const c = contactById(g.inspect.id);
    logger.log("CONTACT_INSPECTED", {
      contactId: c.id, contactType: c.type, inspectionTime: +(logger.now() - g.inspect.start).toFixed(2), ...instrLog(),
    });
    g.inspect = null;
  };

  const scanSector = (i) => {
    if (g.finished || g.activeSector === i) return;
    endInspect();
    const since = g.lastScan[i] == null ? null : +(logger.now() - g.lastScan[i]).toFixed(2);
    g.activeSector = i;
    g.lastScan[i] = logger.now();
    logger.log("SECTOR_SCANNED", {
      sector: WATCH_CONFIG.sectors[i], sectorIndex: i, secondsSinceLastScan: since,
      sectorsCovered: Object.values(g.lastScan).filter((v) => v != null).length,
    });
    detectIn(i);
    rerender();
  };

  const detectIn = (sectorIdx) => {
    g.spawned.forEach((c) => {
      if (c.status === "active" && c.sector === sectorIdx && c.detectedT == null) {
        c.detectedT = logger.now();
        logger.log("CONTACT_DETECTED", {
          contactId: c.id, contactType: c.type, sector: WATCH_CONFIG.sectors[c.sector],
          detectionTime: +(c.detectedT - c.spawnT).toFixed(2), ...instrLog(),
        });
      }
    });
  };

  const inspectContact = (id) => {
    if (g.finished || g.inspect?.id === id) return;
    endInspect();
    g.inspect = { id, start: logger.now() };
    rerender();
  };

  const respond = (response) => {
    if (!g.inspect && !g.selectedForResponse) return;
    const id = g.inspect?.id;
    const c = contactById(id);
    if (!c || c.status !== "active") return;
    const now = logger.now();
    const inspectionTime = +(now - g.inspect.start).toFixed(2);
    const ev = evaluateResponse(c.risk, g.instruction.index, response);
    const sinceChange = g.lastChangeT == null ? null : +(now - g.lastChangeT).toFixed(2);
    logger.log("CONTACT_INSPECTED", { contactId: c.id, contactType: c.type, inspectionTime, ...instrLog() });
    logger.log("CONTACT_RESPONSE", {
      contactId: c.id, contactType: c.type, trueRisk: c.risk, sector: WATCH_CONFIG.sectors[c.sector],
      selectedResponse: response, idealResponse: ev.ideal,
      correct: ev.correct, ruleCompliant: ev.compliant, falseAlert: ev.falseAlert, missedThreat: ev.missedThreat,
      responseTime: inspectionTime, totalTime: +(now - c.spawnT).toFixed(2),
      ...instrLog(), afterInstructionChange: sinceChange != null && sinceChange <= 25, secondsSinceInstructionChange: sinceChange,
    });
    c.status = "handled";
    g.counts.handled += 1;
    g.inspect = null;
    g.toast = `${c.id} → ${response}`;
    setTimeout(() => { g.toast = null; rerender(); }, 1200);
    rerender();
  };

  const finish = () => {
    if (g.finished) return;
    endInspect();
    g.spawned.forEach((c) => {
      if (c.status === "active") expire(c);
    });
    g.finished = true;
    logger.log("GAME_END", {
      timeUsed: +logger.now().toFixed(1),
      totalContacts: g.schedule.length,
      handled: g.counts.handled,
      missed: g.counts.missed,
      sectors: nSectors,
      ...instrLog(),
    });
    logger.end();
    onFinish(logger.sessionId);
  };

  const expire = (c) => {
    c.status = "missed";
    g.counts.missed += 1;
    if (g.inspect?.id === c.id) endInspect();
    logger.log("CONTACT_MISSED", {
      contactId: c.id, contactType: c.type, trueRisk: c.risk, sector: WATCH_CONFIG.sectors[c.sector],
      wasDetected: c.detectedT != null, ...instrLog(),
    });
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (g.finished) return;
      const t = logger.now();
      g.elapsed = t;
      // instruction changes
      const instr = instructionAt(t);
      if (instr.index !== g.instruction.index) {
        const prev = g.instruction;
        g.instruction = instr;
        g.lastChangeT = t;
        logger.log("INSTRUCTION_CHANGE", { fromIndex: prev.index, toIndex: instr.index, newInstruction: instr.text });
      }
      // spawn
      while (g.spawnIdx < g.schedule.length && g.schedule[g.spawnIdx].spawnT <= t) {
        const c = { ...g.schedule[g.spawnIdx], status: "active", detectedT: null };
        g.spawned.push(c);
        g.spawnIdx += 1;
        logger.log("CONTACT_APPEARED", {
          contactId: c.id, contactType: c.type, trueRisk: c.risk, sector: WATCH_CONFIG.sectors[c.sector],
          lifetime: c.lifetime, ...instrLog(),
        });
      }
      // expire
      g.spawned.forEach((c) => {
        if (c.status === "active" && t > c.spawnT + c.lifetime) expire(c);
      });
      // passive detection in the observed sector
      if (g.activeSector != null) detectIn(g.activeSector);
      if (t >= WATCH_CONFIG.duration) finish();
      else rerender();
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- render ----------
  const t = g.elapsed;
  const timeLeft = Math.max(0, WATCH_CONFIG.duration - t);
  const visible = g.spawned.filter((c) => c.status === "active" && c.sector === g.activeSector);
  const inspected = g.inspect ? contactById(g.inspect.id) : null;
  const justChanged = g.lastChangeT != null && t - g.lastChangeT < 8;
  const pressure = Math.round((t / WATCH_CONFIG.duration) * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="card mb-4 grid gap-4 p-4 md:grid-cols-3">
        <div className="flex items-center gap-3">
          <Clock className="text-accent" />
          <div className="flex-1">
            <div className="label">Watch time left</div>
            <div className="font-mono text-2xl text-white">
              {Math.floor(timeLeft / 60)}:{String(Math.floor(timeLeft % 60)).padStart(2, "0")}
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="label mb-1">Time pressure</div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-accent via-amber to-rose transition-all" style={{ width: `${pressure}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Handled {g.counts.handled} · Missed {g.counts.missed}
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button id="watch-end" className="btn-ghost" onClick={finish}>End watch early</button>
        </div>
      </div>

      <div
        key={g.instruction.index}
        className={`animate-slide-in mb-4 flex items-start gap-3 rounded-xl border p-3 ${
          justChanged ? "border-amber bg-amber/15 text-amber" : "border-violet/40 bg-violet/10 text-violet"
        }`}
      >
        <Megaphone size={18} className="mt-0.5 shrink-0" />
        <div>
          <div className="label !text-current opacity-80">{justChanged ? "Instruction updated" : "Current instruction"}</div>
          <div className="text-sm font-semibold text-white">{g.instruction.text}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="card p-4 lg:col-span-7" aria-label="Sector map">
          <svg viewBox="0 0 400 400" className="mx-auto w-full max-w-[520px]">
            <defs>
              <radialGradient id="rg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0f2a35" />
                <stop offset="100%" stopColor="#070c1a" />
              </radialGradient>
              <linearGradient id="sw" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6ee7d8" stopOpacity="0" />
                <stop offset="100%" stopColor="#6ee7d8" stopOpacity="0.35" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="190" fill="url(#rg)" stroke="#27325c" />
            {[60, 120, 185].map((r) => (
              <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="#1d2a4f" strokeDasharray="3 5" />
            ))}
            {WATCH_CONFIG.sectors.map((name, i) => {
              const stale = g.lastScan[i] == null ? null : t - g.lastScan[i];
              const active = g.activeSector === i;
              const staleOpacity = active ? 0.22 : stale == null ? 0.0 : Math.min(0.0 + stale / 80, 0.18);
              const warn = !active && (stale == null ? t > 10 : stale > 20);
              const [lx, ly] = polar(-90 + i * 60 + 30, 150);
              return (
                <g key={name} id={`sector-${i}`} onClick={() => scanSector(i)} className="cursor-pointer">
                  <path
                    d={wedgePath(i, nSectors)}
                    fill={active ? "rgba(110,231,216,0.2)" : warn ? `rgba(251,191,106,${staleOpacity + 0.04})` : "rgba(255,255,255,0.01)"}
                    stroke={active ? "#6ee7d8" : "#27325c"}
                    strokeWidth={active ? 2 : 1}
                    className="transition-all hover:fill-white/10"
                  />
                  <text x={lx} y={ly} textAnchor="middle" fill={active ? "#6ee7d8" : warn ? "#fbbf6a" : "#7f8bb5"} fontSize="11" fontWeight="600">
                    {name.toUpperCase()}
                  </text>
                  <text x={lx} y={ly + 13} textAnchor="middle" fill="#55608a" fontSize="9">
                    {active ? "observing" : stale == null ? "unobserved" : `${Math.floor(stale)}s ago`}
                  </text>
                </g>
              );
            })}
            <g className="radar-sweep pointer-events-none">
              <path d="M200 200 L385 200 A185 185 0 0 0 365 135 Z" fill="url(#sw)" opacity="0.6" />
            </g>
            {visible.map((c) => {
              const a = -90 + c.sector * 60 + (0.12 + 0.76 * c.angle) * 60;
              const [x, y] = polar(a, 185 * c.radius);
              const sel = g.inspect?.id === c.id;
              const left = Math.max(0, 1 - (t - c.spawnT) / c.lifetime);
              return (
                <g key={c.id} id={`contact-${c.id}`} onClick={() => inspectContact(c.id)} className="cursor-pointer">
                  <circle cx={x} cy={y} r="7" fill="none" stroke="#6ee7d8" className="blip-ring" />
                  <circle cx={x} cy={y} r={sel ? 8 : 6} fill={sel ? "#8b7cff" : "#6ee7d8"} stroke="#fff" strokeWidth={sel ? 2 : 0.5} />
                  <circle cx={x} cy={y} r="11" fill="none" stroke={left < 0.3 ? "#ff7a90" : "#6ee7d8"} strokeOpacity="0.7" strokeWidth="2"
                    strokeDasharray={`${left * 69} 69`} transform={`rotate(-90 ${x} ${y})`} />
                  <text x={x} y={y - 15} textAnchor="middle" fill="#dfe6ff" fontSize="9" fontFamily="monospace">{c.id}</text>
                </g>
              );
            })}
            <circle cx="200" cy="200" r="4" fill="#6ee7d8" />
          </svg>
          <p className="mt-2 text-center text-xs text-slate-500">
            Click a sector to observe it. Sectors you leave unobserved are still active — contacts may appear and expire there.
          </p>
        </section>

        <section className="card p-4 lg:col-span-5" aria-label="Contact inspection">
          <h2 className="label mb-3 flex items-center gap-2"><Eye size={14} /> Contact inspection</h2>
          {g.activeSector == null ? (
            <Empty text="Select a sector to start observing." />
          ) : visible.length === 0 && !inspected ? (
            <Empty text={`Sector ${WATCH_CONFIG.sectors[g.activeSector]}: no contacts visible right now.`} />
          ) : (
            <div className="mb-3 flex flex-wrap gap-2">
              {visible.map((c) => (
                <button key={c.id} id={`contact-chip-${c.id}`} onClick={() => inspectContact(c.id)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-mono ${g.inspect?.id === c.id ? "border-violet bg-violet/20 text-white" : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                  {c.id}
                </button>
              ))}
            </div>
          )}

          {inspected && inspected.status === "active" ? (
            <div className="animate-slide-in rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-semibold text-white">{inspected.id} · {inspected.type}</div>
                <span className="chip">Sector {WATCH_CONFIG.sectors[inspected.sector]}</span>
              </div>
              <div className="mt-3">
                <div className="label mb-1">Evidence of a problem: {inspected.score}/100</div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-gradient-to-r from-accent via-amber to-rose" style={{ width: `${inspected.score}%` }} />
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                {inspected.cues.map((cue) => (
                  <li key={cue} className="flex items-center gap-2"><Crosshair size={13} className="text-violet" /> {cue}</li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button id="resp-allow" className="btn bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25" onClick={() => respond("ALLOW")}>
                  <Check size={15} /> ALLOW
                </button>
                <button id="resp-check" className="btn bg-amber/15 text-amber hover:bg-amber/25" onClick={() => respond("CHECK")}>
                  <ShieldQuestion size={15} /> CHECK
                </button>
                <button id="resp-alert" className="btn bg-rose/15 text-rose hover:bg-rose/25" onClick={() => respond("ALERT")}>
                  <Siren size={15} /> ALERT
                </button>
              </div>
            </div>
          ) : (
            visible.length > 0 && <Empty text="Click a contact to inspect its evidence." />
          )}
          {g.toast && <div className="animate-slide-in mt-3 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">Response logged: {g.toast}</div>}
        </section>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div className="grid h-24 place-items-center text-center text-sm text-slate-500">{text}</div>;
}
