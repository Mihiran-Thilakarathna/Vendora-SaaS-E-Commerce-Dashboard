import { useSyncExternalStore } from "react";
import api from "./api";

/**
 * Tracks whether the API is awake.
 *
 * The API runs on a free host that sleeps after ~15 idle minutes; the first request then
 * waits while it boots. We ping /health as soon as the app loads (so the wake-up starts
 * while the visitor is still reading the login page) and keep retrying until it answers.
 *
 * status: "checking" | "waking" | "ready" | "db-down" | "offline"
 */
const MAX_WAIT_MS = 120_000;
const RETRY_MS = 3_000;
const SLOW_AFTER_MS = 1_500;

let state = { status: "checking", since: Date.now() };
const listeners = new Set();
let running = null;

const set = (status) => {
  if (state.status === status) return;
  state = { status, since: state.since };
  listeners.forEach((l) => l());
};

const ping = async () => {
  const { data } = await api.get("/health", { timeout: 15_000, params: { t: Date.now() } });
  // Older API versions don't report `db`; treat a plain OK as ready.
  return !data?.db || data.db === "connected" ? "ready" : "db-down";
};

/** Starts (once) the wake-up loop. Resolves with the final status. */
export const warmUpServer = () => {
  if (running) return running;
  state = { status: "checking", since: Date.now() };
  const slowTimer = window.setTimeout(() => state.status === "checking" && set("waking"), SLOW_AFTER_MS);

  running = (async () => {
    const started = Date.now();
    while (Date.now() - started < MAX_WAIT_MS) {
      try {
        const result = await ping();
        if (result === "ready") {
          set("ready");
          break;
        }
        set("db-down");
      } catch {
        if (state.status === "checking") set("waking");
      }
      await new Promise((r) => window.setTimeout(r, RETRY_MS));
    }
    window.clearTimeout(slowTimer);
    if (state.status !== "ready") set(state.status === "db-down" ? "db-down" : "offline");
    const final = state.status;
    running = null;
    return final;
  })();
  return running;
};

/** Waits until the server is ready (starting the loop if needed). Resolves true when ready. */
export const waitForServer = async () => {
  if (state.status === "ready") return true;
  return (await warmUpServer()) === "ready";
};

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useServerStatus = () => useSyncExternalStore(subscribe, () => state.status);
