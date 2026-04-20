import Dexie from "dexie";
import dexieCloud from "dexie-cloud-addon";

/**
 * Dexie Cloud notes:
 * - @id generates globally unique IDs required for cloud sync
 * - Each authenticated user automatically has a private realm (their userId is the realmId)
 * - The shared realm is created at runtime by the first user to sign in — see bootstrap.js
 * - realmId on a row controls who can see it: a user's private realmId = only them,
 *   the shared realmId = everyone who's a member of that realm
 */

const DB_NAME = "tradtunebook";

export const db = new Dexie(DB_NAME, { addons: [dexieCloud] });

db.version(1).stores({
  tunes: "@id, ownerId, name, type, status, sessionOrgId, sessionOrgMatchStatus, dateAdded, lastPracticed, realmId",
  profiles: "@id, userId, displayName, color, realmId",
  config: "@id, key, realmId"
});

const cloudUrl = import.meta.env.VITE_DEXIE_CLOUD_URL;

if (cloudUrl) {
  db.cloud.configure({
    databaseUrl: cloudUrl,
    requireAuth: true,
    tryUseServiceWorker: true
  });
}