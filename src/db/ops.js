import { db } from "./index.js";
import { getSharedRealmId } from "./bootstrap.js";

/**
 * All writes go through this layer. Every tune/profile is tagged with the
 * shared realm's ID so all members of the realm can see and edit it.
 * If the shared realm hasn't been bootstrapped yet, writes fall back to
 * the user's private realm (which is Dexie Cloud's default).
 */

async function getRealmId() {
  return await getSharedRealmId();
}

export const tuneOps = {
  async create(currentUserId, tune) {
    const now = new Date().toISOString();
    const realmId = await getRealmId();
    const record = {
      ownerId: currentUserId,
      name: tune.name.trim(),
      type: tune.type,
      musicalKey: (tune.musicalKey || "").trim(),
      status: tune.status,
      notes: tune.notes || "",
      recordingUrl: (tune.recordingUrl || "").trim(),
      dateAdded: now,
      lastPracticed: null,
      sessionOrgId: tune.sessionOrgId ?? null,
      sessionOrgMatchStatus: tune.sessionOrgMatchStatus ?? "pending"
    };
    if (realmId) record.realmId = realmId;
    return db.tunes.add(record);
  },

  async update(id, patch) {
    const existing = await db.tunes.get(id);
    if (!existing) return;
    const nameChanged = patch.name && existing.name !== patch.name.trim();
    const cleanPatch = {
      ...patch,
      name: patch.name?.trim() ?? existing.name,
      musicalKey: patch.musicalKey?.trim() ?? existing.musicalKey,
      recordingUrl: patch.recordingUrl?.trim() ?? existing.recordingUrl
    };
    if (nameChanged) {
      cleanPatch.sessionOrgId = null;
      cleanPatch.sessionOrgMatchStatus = "pending";
    }
    return db.tunes.update(id, cleanPatch);
  },

  async markPracticed(id) {
    return db.tunes.update(id, { lastPracticed: new Date().toISOString() });
  },

  async remove(id) {
    return db.tunes.delete(id);
  },

  async copyFromPeer(peerTune, currentUserId) {
    return this.create(currentUserId, {
      name: peerTune.name,
      type: peerTune.type,
      musicalKey: peerTune.musicalKey,
      status: "learning",
      notes: "",
      recordingUrl: "",
      sessionOrgId: peerTune.sessionOrgId,
      sessionOrgMatchStatus: peerTune.sessionOrgMatchStatus
    });
  }
};

export const profileOps = {
  async ensureSelf(currentUserId, fallbackName) {
    const existing = await db.profiles.where("userId").equals(currentUserId).first();
    if (existing) return existing;
    const colors = ["#2E5339", "#8B3A1F", "#A07A2C", "#534AB7", "#0F6E56", "#993556", "#A32D2D", "#3B6D11"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const realmId = await getRealmId();
    const profile = {
      userId: currentUserId,
      displayName: fallbackName || "Player",
      color
    };
    if (realmId) profile.realmId = realmId;
    await db.profiles.add(profile);
    return profile;
  },

  async updateSelf(profileId, patch) {
    return db.profiles.update(profileId, patch);
  }
};
