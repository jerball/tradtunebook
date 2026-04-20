import { db } from "./index.js";

/**
 * Shared realm bootstrap.
 *
 * The very first user (the database creator) creates a realm and a config row
 * pointing every future sign-in at it. Subsequent users read that config row
 * and request access to the realm.
 *
 * Realms aren't automatically shared — users are either members of a realm or
 * they aren't. For a small friend group where you want everyone to see everything,
 * the realm owner invites each friend's email, and when they sign in they see
 * the invite and accept it.
 */

const SHARED_REALM_CONFIG_KEY = "sharedRealmId";

/** Look up the shared realm ID from the config table. Returns null if not yet created. */
export async function getSharedRealmId() {
  const entry = await db.config.where("key").equals(SHARED_REALM_CONFIG_KEY).first();
  return entry?.value ?? null;
}

/**
 * Ensures the shared realm exists. If not, the current user creates it and writes
 * a config row announcing the realm ID. Returns the realm ID.
 *
 * Safe to call multiple times — only the first caller creates the realm.
 */
export async function ensureSharedRealm() {
  // Already exists?
  const existing = await getSharedRealmId();
  if (existing) return existing;

  const currentUser = db.cloud.currentUser?.value;
  if (!currentUser?.isLoggedIn) {
    throw new Error("Must be signed in to create the shared realm");
  }

  // Create a new realm owned by the current user
  const realmId = "rlm-shared-" + crypto.randomUUID().slice(0, 8);
  await db.realms.add({
    realmId,
    name: "Trad Tune Book — Shared",
    represents: "The shared tunebook everyone sees"
  });

  // Add ourselves as a member (realm owner is automatically granted access;
  // writing this member row makes the owner/admin role explicit)
  await db.members.add({
    realmId,
    userId: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name,
    invite: false,
    invitedDate: new Date(),
    accepted: new Date(),
    permissions: { manage: "*" }
  });

  // Write the discovery config row IN the shared realm so it syncs to new members.
  // Note: new members won't see this row until they accept their invite, so the
  // invite flow in the UI will carry the realm ID out-of-band too.
  await db.config.add({
    key: SHARED_REALM_CONFIG_KEY,
    value: realmId,
    realmId
  });

  return realmId;
}

/**
 * Invite a user to the shared realm by email. After they accept from within
 * the app, they'll see all shared tunes.
 */
export async function inviteToSharedRealm(email) {
  const realmId = await getSharedRealmId();
  if (!realmId) throw new Error("Shared realm not set up yet");
  await db.members.add({
    realmId,
    email: email.trim().toLowerCase(),
    invite: true,
    invitedDate: new Date(),
    permissions: { add: ["tunes", "profiles"], update: ["tunes", "profiles"] }
  });
}
