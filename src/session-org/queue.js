import { db } from "../db/index.js";
import { lookupTune } from "./lookup.js";

/**
 * Drains the session.org lookup queue. Finds all tunes with status "pending"
 * and attempts to resolve them. Runs when the app comes online, and periodically
 * while online.
 *
 * Idempotent and safe to call repeatedly.
 */

let draining = false;

export async function drainQueue() {
  if (draining || !navigator.onLine) return;
  draining = true;
  try {
    const pending = await db.tunes
      .where("sessionOrgMatchStatus")
      .equals("pending")
      .toArray();

    for (const tune of pending) {
      if (!navigator.onLine) break;
      const result = await lookupTune(tune.name, { type: tune.type });

      // Re-read in case it was edited while we were waiting on the network
      const fresh = await db.tunes.get(tune.id);
      if (!fresh) continue;
      if (fresh.name !== tune.name) continue; // name changed mid-flight, skip
      if (fresh.sessionOrgManual) continue; // user manually set, don't override

      await db.tunes.update(tune.id, {
        sessionOrgId: result.id,
        sessionOrgMatchStatus: result.status,
        sessionOrgCandidates: result.candidates ?? null
      });

      // Small delay between requests to be kind to thesession.org
      await new Promise((r) => setTimeout(r, 200));
    }
  } finally {
    draining = false;
  }
}

/** Install global listeners that trigger the drain when online status changes. */
export function installQueueRunner() {
  // Run on startup
  drainQueue();

  // Run when we come online
  window.addEventListener("online", drainQueue);

  // Poll every 5 minutes as a safety net
  setInterval(drainQueue, 5 * 60 * 1000);
}
