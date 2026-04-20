import { useEffect, useState } from "react";
import { useObservable, useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/index.js";
import { profileOps } from "../db/ops.js";

/**
 * Wraps Dexie Cloud's current-user observable and keeps a local profile row in sync.
 * Returns { userId, user, profile, login, logout } where `profile` carries display name + color.
 *
 * Falls back to a deterministic local user ID when Dexie Cloud isn't configured
 * (useful in dev or when the VITE_DEXIE_CLOUD_URL env var is missing).
 */

const LOCAL_FALLBACK_KEY = "ttb.localUserId";

function getLocalFallbackId() {
  let id = localStorage.getItem(LOCAL_FALLBACK_KEY);
  if (!id) {
    id = "local-" + crypto.randomUUID();
    localStorage.setItem(LOCAL_FALLBACK_KEY, id);
  }
  return id;
}

export function useCurrentUser() {
  // db.cloud.currentUser is itself an observable — pass it directly, don't wrap in a callback returning null
  const cloudUser = useObservable(db.cloud?.currentUser);

  const [fallbackId] = useState(() =>
    db.cloud ? null : getLocalFallbackId()
  );

  const userId = cloudUser?.userId ?? fallbackId;

  // Ensure a profile row exists
  useEffect(() => {
    if (!userId) return;
    const fallbackName = cloudUser?.name || cloudUser?.email?.split("@")[0] || "Player";
    profileOps.ensureSelf(userId, fallbackName);
  }, [userId, cloudUser]);

  const profile = useLiveQuery(
    () => (userId ? db.profiles.where("userId").equals(userId).first() : undefined),
    [userId]
  );

  return {
    userId,
    user: cloudUser,
    profile,
    login: () => db.cloud?.login?.(),
    logout: () => db.cloud?.logout?.()
  };
}