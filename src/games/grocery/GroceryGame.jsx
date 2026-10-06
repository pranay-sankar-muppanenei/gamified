import { useEffect, useRef, useState } from "react";
import {
  ShoppingCart, Search, Plus, Trash2, SkipForward, Clock, Wallet, AlertTriangle,
  Star, CheckCircle2, Flag, Ban, Scale,
} from "lucide-react";
import { createSessionLogger } from "../../services/eventLogger";
import { GROCERY_CONFIG, REQUIREMENTS, UNEXPECTED_EVENTS } from "./scenario";
import GameBrief from "../../components/GameBrief";

/**
 * Game 1 — Grocery Planning
 * Mutable game state lives in a ref (`g`) so timers and handlers always see the
 * latest values; `rerender()` pushes changes to the UI. Every meaningful action
 * is written through `logger.log(...)` (see services/eventLogger.js).
 */
export default function GroceryGame({ onFinish }) {
  const [started, setStarted] = useState(false);
  if (!started) {
    return (
      <GameBrief
        icon={ShoppingCart}
        title="Grocery Planning"
        subtitle="Resource allocation under changing conditions"
        rules={[
          `Fill your list of requirements within a budget of $${GROCERY_CONFIG.initialBudget} and ${GROCERY_CONFIG.timeLimit} seconds.`,
          "Select a list entry, click products to inspect them, then Add, Skip or Remove.",
          "Essential entries are marked. Optional entries may be skipped.",
          "Conditions will change without warning — prices, stock, requirements and even your budget.",
          "There is no single perfect cart. We study how you decide, compare and adapt.",
        ]}
        onStart={() => setStarted(true)}
      />
    );
  }
  return <GroceryPlay onFinish={onFinish} />;
}

function Quality({ q }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={12} className={i <= q ? "fill-amber text-amber" : "text-slate-600"} />
      ))}
    </span>
  );
}

function GroceryPlay({ onFinish }) {
  const [, tick] = useState(0);
  const rerender = () => tick((n) => n + 1);
  const loggerRef = useRef(null);
  if (!loggerRef.current) loggerRef.current = createSessionLogger("grocery");
  const logger = loggerRef.current;

  const gRef = useRef(null);
  if (!gRef.current) {
    gRef.current = {
      reqs: REQUIREMENTS.map((r) => ({ ...r })),
      prices: Object.fromEntries(REQUIREMENTS.flatMap((r) => r.products.map((p) => [p.id, p.price]))),
      unavailable: {},
      budget: GROCERY_CONFIG.initialBudget,
      cart: {},
      skipped: {},
      focus: null,
      inspect: null,
      reqInspected: {},
      reqFirstInspect: {},
      reqFocusT: {},
      lastDecisionT: {},
      decided: {},
      abandonedLogged: {},
      pending: [],
      fired: {},
      banner: null,
      flash: null,
      finished: false,
      decisionsMade: 0,
      elapsed: 0,
    };
  }
  const g = gRef.current;

  // ---------- derived helpers ----------
  const productOf = (pid) => g.reqs.flatMap((r) => r.products.map((p) => ({ ...p, reqId: r.id }))).find((p) => p.id === pid);
  const total = () => Object.values(g.cart).reduce((s, pid) => s + g.prices[pid], 0);
  const remaining = () => g.budget - total();
  const reqOf = (rid) => g.reqs.find((r) => r.id === rid);
  const base = () => ({ budgetRemaining: remaining() });

  const itemFields = (pid) => {
    const p = productOf(pid);
    return { itemId: pid, itemName: p.name, requirementId: p.reqId, price: g.prices[pid], quality: p.quality };
  };

  // ---------- inspection ----------
  const endInspect = () => {
    if (!g.inspect) return;
    const { pid, start } = g.inspect;
    logger.log("ITEM_INSPECTED", {
      ...itemFields(pid), timeTaken: +(logger.now() - start).toFixed(2), ...base(),
    });
    g.inspect = null;
  };

  const selectRequirement = (rid) => {
    if (g.finished || g.focus === rid) return;
    endInspect();
    const prev = g.focus;
    if (prev && !g.decided[prev] && !g.cart[prev] && (g.reqInspected[prev]?.size || 0) > 0 && !g.abandonedLogged[prev]) {
      logger.log("ITEM_ABANDONED", {
        requirementId: prev, essential: reqOf(prev).essential,
        alternativesInspected: g.reqInspected[prev].size, ...base(),
      });
      g.abandonedLogged[prev] = true;
    }
    g.focus = rid;
    g.reqFocusT[rid] ??= logger.now();
    logger.log("REQUIREMENT_FOCUSED", { requirementId: rid, essential: reqOf(rid).essential, ...base() });
    rerender();
  };

  const inspectProduct = (pid) => {
    if (g.finished || g.unavailable[pid]) return;
    if (g.inspect?.pid === pid) return;
    endInspect();
    const p = productOf(pid);
    const set = (g.reqInspected[p.reqId] ??= new Set());
    const others = [...set].filter((x) => x !== pid);
    set.add(pid);
    g.reqFirstInspect[p.reqId] ??= logger.now();
    g.inspect = { pid, start: logger.now() };
    if (others.length > 0) {
      logger.log("ITEM_COMPARED", { ...itemFields(pid), comparedWith: others, alternativesInspected: set.size, ...base() });
    }
    rerender();
  };

  // ---------- response to unexpected events ----------
  const recordResponse = (action) => {
    g.pending.forEach((ev) => {
      logger.log("EVENT_RESPONSE", {
        eventId: ev.id, eventType: ev.type, action,
        responseTime: +(logger.now() - ev.t).toFixed(2), ...base(),
      });
    });
    g.pending = [];
  };

  const decisionTimeFor = (rid) => {
    const startT = g.lastDecisionT[rid] ?? g.reqFirstInspect[rid] ?? g.reqFocusT[rid] ?? logger.now();
    return +(logger.now() - startT).toFixed(2);
  };

  const flash = (msg) => {
    g.flash = msg;
    rerender();
    setTimeout(() => { if (g.flash === msg) { g.flash = null; rerender(); } }, 2200);
  };

  // ---------- player actions ----------
  const addToCart = (pid) => {
    if (g.finished) return;
    const p = productOf(pid);
    endInspect();
    const existing = g.cart[p.reqId];
    if (existing === pid) return;
    const budgetBefore = remaining();
    const newRemaining = budgetBefore + (existing ? g.prices[existing] : 0) - g.prices[pid];
    if (newRemaining < 0) {
      logger.log("BUDGET_EXCEEDED_ATTEMPT", { ...itemFields(pid), budgetBefore, shortfall: -newRemaining });
      flash("Not enough budget for this item.");
      return;
    }
    const decisionTime = decisionTimeFor(p.reqId);
    const alt = g.reqInspected[p.reqId]?.size || 0;
    if (existing) {
      logger.log("ITEM_SWITCHED", {
        ...itemFields(pid), fromItemId: existing, fromPrice: g.prices[existing],
        decisionTime, budgetBefore, budgetAfter: newRemaining, alternativesInspected: alt,
      });
    } else {
      logger.log("ITEM_PURCHASED", {
        ...itemFields(pid), essential: reqOf(p.reqId).essential, decisionTime,
        budgetBefore, budgetAfter: newRemaining, alternativesInspected: alt,
        wasInspected: !!g.reqInspected[p.reqId]?.has(pid), decisionIndex: g.decisionsMade,
      });
    }
    if (!g.decided[p.reqId]) g.decisionsMade += 1;
    g.cart[p.reqId] = pid;
    delete g.skipped[p.reqId];
    g.decided[p.reqId] = true;
    g.lastDecisionT[p.reqId] = logger.now();
    recordResponse(existing ? "SWITCH" : "ADD");
    rerender();
  };

  const removeFromCart = (rid) => {
    const pid = g.cart[rid];
    if (!pid || g.finished) return;
    endInspect();
    const budgetBefore = remaining();
    delete g.cart[rid];
    g.decided[rid] = false;
    logger.log("ITEM_REMOVED", { ...itemFields(pid), budgetBefore, budgetAfter: remaining(), voluntary: true });
    g.lastDecisionT[rid] = logger.now();
    recordResponse("REMOVE");
    rerender();
  };

  const skipRequirement = (rid) => {
    if (g.finished || g.cart[rid]) return;
    endInspect();
    const decisionTime = decisionTimeFor(rid);
    if (!g.decided[rid]) g.decisionsMade += 1;
    logger.log("ITEM_DISMISSED", {
      requirementId: rid, essential: reqOf(rid).essential, decisionTime,
      alternativesInspected: g.reqInspected[rid]?.size || 0, ...base(), decisionIndex: g.decisionsMade - 1,
    });
    g.skipped[rid] = true;
    g.decided[rid] = true;
    g.lastDecisionT[rid] = logger.now();
    recordResponse("SKIP");
    rerender();
  };

  // ---------- unexpected events ----------
  const fireEvent = (ev) => {
    g.fired[ev.id] = true;
    let affectsCart = false;
    if (ev.type === "PRICE_INCREASE") {
      const old = g.prices[ev.productId];
      g.prices[ev.productId] = ev.newPrice;
      affectsCart = Object.values(g.cart).includes(ev.productId);
      logger.log("UNEXPECTED_EVENT", { eventId: ev.id, eventType: ev.type, itemId: ev.productId, oldPrice: old, newPrice: ev.newPrice, affectsCart, ...base() });
    } else if (ev.type === "ITEM_UNAVAILABLE") {
      const p = productOf(ev.productId);
      if (g.inspect?.pid === ev.productId) endInspect();
      g.unavailable[ev.productId] = true;
      if (g.cart[p.reqId] === ev.productId) {
        affectsCart = true;
        const before = remaining();
        delete g.cart[p.reqId];
        g.decided[p.reqId] = false;
        logger.log("ITEM_AUTO_REMOVED", { ...itemFields(ev.productId), budgetBefore: before, budgetAfter: remaining(), reason: "UNAVAILABLE" });
      }
      logger.log("UNEXPECTED_EVENT", { eventId: ev.id, eventType: ev.type, itemId: ev.productId, affectsCart, ...base() });
    } else if (ev.type === "NEW_REQUIREMENT") {
      g.reqs.push({ ...ev.requirement });
      g.prices = { ...g.prices, ...Object.fromEntries(ev.requirement.products.map((p) => [p.id, p.price])) };
      logger.log("UNEXPECTED_EVENT", { eventId: ev.id, eventType: ev.type, requirementId: ev.requirement.id, affectsCart: false, ...base() });
    } else if (ev.type === "BUDGET_CHANGE") {
      const old = g.budget;
      g.budget += ev.delta;
      affectsCart = total() > g.budget;
      logger.log("UNEXPECTED_EVENT", { eventId: ev.id, eventType: ev.type, oldBudget: old, newBudget: g.budget, affectsCart, budgetRemaining: remaining() });
    }
    g.pending.push({ id: ev.id, type: ev.type, t: logger.now() });
    g.banner = { id: ev.id, text: ev.text };
    rerender();
  };

  // ---------- finish ----------
  const finish = (reason) => {
    if (g.finished) return;
    endInspect();
    if (g.focus && !g.decided[g.focus] && !g.cart[g.focus] && (g.reqInspected[g.focus]?.size || 0) > 0 && !g.abandonedLogged[g.focus]) {
      logger.log("ITEM_ABANDONED", { requirementId: g.focus, essential: reqOf(g.focus).essential, alternativesInspected: g.reqInspected[g.focus].size, ...base() });
    }
    g.pending.forEach((ev) =>
      logger.log("EVENT_RESPONSE", { eventId: ev.id, eventType: ev.type, action: "NONE", responseTime: null, unanswered: true }),
    );
    g.pending = [];
    g.finished = true;
    const picks = Object.values(g.cart).map(productOf);
    const essentials = g.reqs.filter((r) => r.essential);
    logger.log("GAME_END", {
      reason, timeUsed: +logger.now().toFixed(1),
      initialBudget: GROCERY_CONFIG.initialBudget, finalBudget: g.budget,
      finalSpending: total(), budgetRemaining: remaining(), overBudget: remaining() < 0,
      itemsPurchased: picks.length,
      essentialsFilled: essentials.filter((r) => g.cart[r.id]).length,
      essentialsTotal: essentials.length,
      averageQuality: picks.length ? +(picks.reduce((s, p) => s + p.quality, 0) / picks.length).toFixed(2) : 0,
    });
    logger.end();
    onFinish(logger.sessionId);
  };

  // ---------- clock ----------
  useEffect(() => {
    const id = setInterval(() => {
      if (g.finished) return;
      const t = logger.now();
      g.elapsed = t;
      UNEXPECTED_EVENTS.forEach((ev) => { if (!g.fired[ev.id] && t >= ev.t) fireEvent(ev); });
      if (t >= GROCERY_CONFIG.timeLimit) finish("TIME_UP");
      else rerender();
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- render ----------
  const timeLeft = Math.max(0, GROCERY_CONFIG.timeLimit - g.elapsed);
  const spent = total();
  const over = remaining() < 0;
  const focusReq = g.focus ? reqOf(g.focus) : null;
  const inspected = g.inspect ? productOf(g.inspect.pid) : null;
  const pct = Math.min(100, (spent / Math.max(1, g.budget)) * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* HUD */}
      <div className="card mb-4 grid gap-4 p-4 md:grid-cols-3">
        <div className="flex items-center gap-3">
          <Clock className="text-accent" />
          <div className="flex-1">
            <div className="label">Time left</div>
            <div className="font-mono text-2xl text-white">
              {Math.floor(timeLeft / 60)}:{String(Math.floor(timeLeft % 60)).padStart(2, "0")}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-accent transition-all" style={{ width: `${(timeLeft / GROCERY_CONFIG.timeLimit) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 md:col-span-1">
          <Wallet className={over ? "text-rose" : "text-violet"} />
          <div className="flex-1">
            <div className="label">Budget · spent ${spent} of ${g.budget}</div>
            <div className={`font-mono text-2xl ${over ? "text-rose" : "text-white"}`}>${remaining()} left</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full transition-all ${over ? "bg-rose" : "bg-violet"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            id="grocery-finish"
            className="btn-primary"
            disabled={over}
            onClick={() => finish("PLAYER_FINISHED")}
          >
            <Flag size={16} /> Finish shopping
          </button>
        </div>
      </div>

      {g.banner && (
        <div key={g.banner.id} className="animate-slide-in mb-4 flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-3 text-amber">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1 text-sm font-medium">{g.banner.text}</div>
          <button className="text-xs underline opacity-80" onClick={() => { g.banner = null; rerender(); }}>Dismiss</button>
        </div>
      )}
      {over && (
        <div className="mb-4 rounded-xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose">
          Your cart exceeds the current budget. Remove or swap items to continue.
        </div>
      )}
      {g.flash && <div className="animate-slide-in mb-4 rounded-xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose">{g.flash}</div>}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Requirements */}
        <section className="card p-4 lg:col-span-3" aria-label="Requirement list">
          <h2 className="label mb-3">Required list</h2>
          <ul className="space-y-2">
            {g.reqs.map((r) => {
              const inCart = g.cart[r.id];
              const status = inCart ? "In cart" : g.skipped[r.id] ? "Skipped" : "Open";
              return (
                <li key={r.id}>
                  <button
                    id={`req-${r.id}`}
                    onClick={() => selectRequirement(r.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all hover:bg-white/10 ${
                      g.focus === r.id ? "border-accent/60 bg-accent/10" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{r.label}</span>
                      {inCart ? <CheckCircle2 size={16} className="text-accent" /> : g.skipped[r.id] ? <Ban size={16} className="text-slate-500" /> : null}
                    </div>
                    <div className="mt-1 flex gap-1.5">
                      <span className={`chip ${r.essential ? "!border-rose/40 !text-rose" : ""}`}>{r.essential ? "Essential" : "Optional"}</span>
                      <span className="chip">{status}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Products */}
        <section className="card p-4 lg:col-span-6" aria-label="Products">
          {!focusReq ? (
            <div className="flex h-72 flex-col items-center justify-center text-center text-slate-400">
              <Search size={32} className="mb-3 text-accent" />
              Select an entry from your list to see available products.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-white">{focusReq.label}</h2>
                <button
                  id="skip-requirement"
                  className="btn-ghost !py-1.5 text-xs"
                  disabled={!!g.cart[focusReq.id]}
                  onClick={() => skipRequirement(focusReq.id)}
                >
                  <SkipForward size={14} /> Skip entry
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {focusReq.products.map((p) => {
                  const price = g.prices[p.id];
                  const unavailable = g.unavailable[p.id];
                  const inCart = g.cart[focusReq.id] === p.id;
                  const isInspected = g.inspect?.pid === p.id;
                  const hiked = price > p.price;
                  return (
                    <div
                      key={p.id}
                      id={`product-${p.id}`}
                      onClick={() => inspectProduct(p.id)}
                      className={`cursor-pointer rounded-xl border p-3 transition-all ${
                        unavailable ? "cursor-not-allowed opacity-40"
                          : inCart ? "border-accent bg-accent/10"
                          : isInspected ? "border-violet bg-violet/10"
                          : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/30"
                      }`}
                    >
                      <div className="text-sm font-semibold text-white">{p.name}</div>
                      <div className="mt-1"><Quality q={p.quality} /></div>
                      <div className="mt-2 font-mono text-lg text-white">
                        ${price}
                        {hiked && <span className="ml-1.5 text-xs text-rose line-through opacity-70">${p.price}</span>}
                      </div>
                      {hiked && <div className="text-[11px] font-medium text-rose">Price increased</div>}
                      {unavailable ? (
                        <div className="mt-2 text-xs font-semibold text-rose">Unavailable</div>
                      ) : inCart ? (
                        <button className="btn-ghost mt-2 w-full !py-1.5 text-xs" onClick={(e) => { e.stopPropagation(); removeFromCart(focusReq.id); }}>
                          <Trash2 size={13} /> Remove
                        </button>
                      ) : (
                        <button className="btn-primary mt-2 w-full !py-1.5 text-xs" onClick={(e) => { e.stopPropagation(); addToCart(p.id); }}>
                          <Plus size={13} /> {g.cart[focusReq.id] ? "Swap" : "Add"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {inspected && (
                <div className="animate-slide-in mt-4 rounded-xl border border-violet/40 bg-violet/10 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <Scale size={15} className="text-violet" /> Inspecting: {inspected.name}
                  </div>
                  {[
                    ["Freshness / condition", inspected.quality],
                    ["Durability", Math.max(1, inspected.quality - (inspected.id.endsWith("3") ? 0 : 0))],
                    ["Value for money", Math.max(1, Math.min(5, Math.round((inspected.quality * 100) / (g.prices[inspected.id] / 30))))],
                  ].map(([label, v]) => (
                    <div key={label} className="mb-1.5 flex items-center gap-3 text-xs text-slate-300">
                      <span className="w-36">{label}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-violet" style={{ width: `${(v / 5) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Cart */}
        <section className="card p-4 lg:col-span-3" aria-label="Cart">
          <h2 className="label mb-3 flex items-center gap-2"><ShoppingCart size={14} /> Cart</h2>
          {Object.keys(g.cart).length === 0 ? (
            <p className="text-sm text-slate-500">Your cart is empty.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(g.cart).map(([rid, pid]) => {
                const p = productOf(pid);
                return (
                  <li key={rid} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span className="text-slate-200">{p.name}</span>
                    <span className="font-mono text-white">${g.prices[pid]}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex justify-between border-t border-white/10 pt-3 text-sm">
            <span className="text-slate-400">Total</span>
            <span className="font-mono text-white">${spent}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
