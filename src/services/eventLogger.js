/**
 * EVENT LOGGER  (data-collection layer)
 * ---------------------------------------------------------------------------
 * Every meaningful player action is stored as one flat, JSON-serialisable event:
 *
 *   { playerId, gameId, sessionId, timestamp, t, event, ...payload }
 *
 *   timestamp : unix time in seconds (float)
 *   t         : seconds since the session started (convenient for timelines/ML)
 *
 * The prototype persists to localStorage through the `localStorageAdapter`.
 *
 * >>> FUTURE BACKEND INTEGRATION (FastAPI + PostgreSQL) <<<
 * Replace `localStorageAdapter` with an `apiAdapter` implementing the same
 * four methods (appendEvent, loadEvents, loadSessions, saveSession/clear):
 *
 *   POST /api/sessions                      -> INSERT INTO sessions(...)
 *   POST /api/events  (batched, every ~2s)  -> INSERT INTO events(...)
 *   GET  /api/sessions/{id}/events          -> SELECT * FROM events WHERE ...
 *
 * Suggested PostgreSQL schema:
 *   sessions(session_id PK, player_id, game_id, started_at, ended_at)
 *   events(id BIGSERIAL PK, session_id FK, player_id, game_id, ts DOUBLE PRECISION,
 *          t DOUBLE PRECISION, event TEXT, payload JSONB)
 * Nothing else in the app needs to change – games only call `createSessionLogger`.
 */

const EVENTS_KEY = "wgba.events.v1";
const SESSIONS_KEY = "wgba.sessions.v1";
const PLAYER_KEY = "wgba.playerId";

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

/** Storage adapter. Swap for an HTTP adapter when the FastAPI backend exists. */
export const localStorageAdapter = {
  appendEvent(evt) {
    const all = read(EVENTS_KEY, []);
    all.push(evt);
    write(EVENTS_KEY, all);
  },
  loadEvents: () => read(EVENTS_KEY, []),
  loadSessions: () => read(SESSIONS_KEY, []),
  saveSessions: (s) => write(SESSIONS_KEY, s),
  clear() {
    localStorage.removeItem(EVENTS_KEY);
    localStorage.removeItem(SESSIONS_KEY);
  },
};

let adapter = localStorageAdapter;
export const setStorageAdapter = (a) => (adapter = a);

// ---- player id ------------------------------------------------------------
export const getPlayerId = () => localStorage.getItem(PLAYER_KEY) || "P001";
export const setPlayerId = (id) => localStorage.setItem(PLAYER_KEY, id.trim() || "P001");

// ---- sessions & events ----------------------------------------------------
export function createSessionLogger(gameId, playerId = getPlayerId()) {
  const sessionId = `${gameId}_${Date.now().toString(36)}`;
  const startedAt = Date.now() / 1000;
  const sessions = adapter.loadSessions();
  sessions.push({ sessionId, gameId, playerId, startedAt, endedAt: null });
  adapter.saveSessions(sessions);

  const log = (event, payload = {}) => {
    const timestamp = Date.now() / 1000;
    const evt = {
      playerId,
      gameId,
      sessionId,
      timestamp: +timestamp.toFixed(3),
      t: +(timestamp - startedAt).toFixed(2),
      event,
      ...payload,
    };
    adapter.appendEvent(evt);
    return evt;
  };

  const end = () => {
    const all = adapter.loadSessions();
    const s = all.find((x) => x.sessionId === sessionId);
    if (s) s.endedAt = Date.now() / 1000;
    adapter.saveSessions(all);
  };

  /** seconds elapsed since session start */
  const now = () => Date.now() / 1000 - startedAt;

  return { sessionId, playerId, gameId, log, end, now };
}

export const getEvents = (sessionId) =>
  adapter.loadEvents().filter((e) => e.sessionId === sessionId);

export const getSessions = () => adapter.loadSessions();

/** Latest completed session of a game for a given player (or null). */
export function getLatestSession(gameId, playerId = getPlayerId()) {
  const done = adapter
    .loadSessions()
    .filter((s) => s.gameId === gameId && s.playerId === playerId && s.endedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
  return done[0] || null;
}

export const clearAllData = () => adapter.clear();

export const exportAll = () => ({
  sessions: adapter.loadSessions(),
  events: adapter.loadEvents(),
});
