/**
 * thesession.org integration.
 *
 * Strategy: two-tier matching.
 *   1. Fast path: check our bundled aliases dump for an instant offline match.
 *   2. Slow path: if the aliases dump doesn't resolve it, hit the live search API.
 *
 * The dump (aliases.json) maps every known tune alias to a canonical tune ID.
 * It's regenerated from https://github.com/adactio/TheSession-data via `npm run fetch-aliases`.
 */

const SEARCH_ENDPOINT = "https://thesession.org/tunes/search";

let aliasesPromise = null;

/** Load the bundled aliases dump once, cache the promise. */
function loadAliases() {
  if (!aliasesPromise) {
    aliasesPromise = fetch("/data/aliases.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Aliases fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        // Build a lookup map: normalized alias -> tune_id
        // The dump is an array of {tune_id, alias, name} records.
        const map = new Map();
        for (const entry of data) {
          const k = normalizeName(entry.alias || entry.name);
          if (k && !map.has(k)) map.set(k, entry.tune_id);
        }
        return map;
      })
      .catch((err) => {
        console.warn("Could not load aliases dump, falling back to live search only:", err);
        return new Map();
      });
  }
  return aliasesPromise;
}

/**
 * Normalize a tune name for matching. Strips leading "The", lowercases, collapses whitespace,
 * removes punctuation. Aggressive by design — trad tune names vary wildly in casing and articles.
 */
export function normalizeName(name) {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/['''’`]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Look up a tune name against thesession.org.
 * Returns: { id: number|null, status: "matched"|"no_match"|"ambiguous", candidates?: [...] }
 */
export async function lookupTune(name, { type } = {}) {
  const normalized = normalizeName(name);
  if (!normalized) return { id: null, status: "no_match" };

  // Fast path: aliases dump
  const aliases = await loadAliases();
  const hit = aliases.get(normalized);
  if (hit) {
    return { id: hit, status: "matched" };
  }

  // Slow path: live search
  if (!navigator.onLine) {
    // Can't resolve now — caller should keep this queued
    return { id: null, status: "pending" };
  }

  try {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set("q", name);
    url.searchParams.set("format", "json");
    url.searchParams.set("perpage", "10");
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Search returned ${res.status}`);
    const data = await res.json();
    const tunes = data.tunes || [];
    if (tunes.length === 0) return { id: null, status: "no_match" };

    // Filter by type if we know it, e.g. if user said this is a reel, ignore jigs
    let candidates = tunes;
    if (type) {
      const filtered = tunes.filter((t) => (t.type || "").toLowerCase() === type.toLowerCase());
      if (filtered.length > 0) candidates = filtered;
    }

    // Exact normalized match wins
    const exact = candidates.find((t) => normalizeName(t.name) === normalized);
    if (exact) return { id: exact.id, status: "matched" };

    // Single candidate, take it
    if (candidates.length === 1) return { id: candidates[0].id, status: "matched" };

    // Multiple candidates and no exact match — ambiguous, let the user pick
    return {
      id: null,
      status: "ambiguous",
      candidates: candidates.slice(0, 5).map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        url: t.url
      }))
    };
  } catch (err) {
    console.warn("Live lookup failed:", err);
    return { id: null, status: "pending" };
  }
}
