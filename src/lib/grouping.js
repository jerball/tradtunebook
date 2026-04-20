import { normalizeName } from "../session-org/lookup.js";

/**
 * Given a tune and all tunes in the shared DB, return the list of *other users*
 * who also have this tune in their tunebook.
 *
 * Grouping key:
 *   - sessionOrgId if the tune has been matched to thesession.org
 *   - normalized name otherwise (fallback for unmatched / pending tunes)
 *
 * This means "The Kesh" and "Kesh Jig" owned by different users will group together
 * once they've both been matched to session.org ID 6.
 */

export function groupingKey(tune) {
  if (tune.sessionOrgId) return `sid:${tune.sessionOrgId}`;
  return `name:${normalizeName(tune.name)}`;
}

export function whoElseHas(tune, allTunes) {
  const key = groupingKey(tune);
  const otherOwners = new Set();
  for (const t of allTunes) {
    if (t.ownerId === tune.ownerId) continue;
    if (groupingKey(t) === key) otherOwners.add(t.ownerId);
  }
  return Array.from(otherOwners);
}

/**
 * For the "add tune" suggestion flow: find any tunes owned by other users
 * whose name matches (normalized) the name the current user is typing.
 */
export function findPeerMatches(name, currentUserId, allTunes) {
  const key = normalizeName(name);
  if (!key || key.length < 3) return [];
  return allTunes.filter(
    (t) => t.ownerId !== currentUserId && normalizeName(t.name) === key
  );
}
