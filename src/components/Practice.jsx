import { useMemo, useState } from "react";
import { tuneOps } from "../db/ops.js";
import { formatAgo } from "../lib/constants.js";

export function Practice({ tunes, currentUserId }) {
  const [currentId, setCurrentId] = useState(null);
  const [history, setHistory] = useState([]);
  const [skippedIds, setSkippedIds] = useState(() => new Set());
  const [typeFilter, setTypeFilter] = useState("all");

  const myKnown = useMemo(
    () => tunes.filter((t) => t.ownerId === currentUserId && t.status === "know"),
    [tunes, currentUserId]
  );

  const typesPresent = useMemo(() => {
    const s = new Set();
    myKnown.forEach((t) => s.add(t.type));
    return Array.from(s).sort();
  }, [myKnown]);

  const eligible = useMemo(() => {
    if (typeFilter === "all") return myKnown;
    return myKnown.filter((t) => t.type === typeFilter);
  }, [myKnown, typeFilter]);

  const currentTune = currentId ? tunes.find((t) => t.id === currentId) : null;
  // Clear current if it's no longer eligible (user changed filter, or tune was deleted)
  const effectiveCurrent =
    currentTune && eligible.find((t) => t.id === currentId) ? currentTune : null;

  const availableCount = eligible.filter((t) => !skippedIds.has(t.id)).length;

  const drawTune = () => {
    if (eligible.length === 0) return;
    let pool = eligible.filter((t) => !skippedIds.has(t.id));
    if (pool.length === 0) {
      // Skip pile has swallowed everything. Reset and use the full eligible set.
      setSkippedIds(new Set());
      pool = eligible;
    }
    // Bias away from recent picks
    const recent = new Set(history.slice(-Math.min(5, Math.floor(pool.length / 2))));
    const fresh = pool.filter((t) => !recent.has(t.id));
    const finalPool = fresh.length > 0 ? fresh : pool;
    const pick = finalPool[Math.floor(Math.random() * finalPool.length)];
    setCurrentId(pick.id);
    setHistory((h) => [...h, pick.id]);
  };

  const skipCurrent = () => {
    if (!effectiveCurrent) return;
    setSkippedIds((prev) => new Set(prev).add(effectiveCurrent.id));
    drawTune();
  };

  const markPracticed = async () => {
    if (!effectiveCurrent) return;
    await tuneOps.markPracticed(effectiveCurrent.id);
  };

  return (
    <div>
      <div className="ttb-practice-bar">
        <div className="ttb-practice-bar-group">
          <label>Draw from</label>
          <select
            className="ttb-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">any type ({myKnown.length})</option>
            {typesPresent.map((t) => {
              const count = myKnown.filter((x) => x.type === t).length;
              return (
                <option key={t} value={t}>
                  {t} ({count})
                </option>
              );
            })}
          </select>
        </div>
        {skippedIds.size > 0 && (
          <div className="ttb-practice-bar-group">
            <span className="ttb-skip-badge">
              {skippedIds.size} skipped this session
            </span>
            <button
              className="ttb-secondary"
              style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
              onClick={() => setSkippedIds(new Set())}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {!effectiveCurrent ? (
        <div className="ttb-practice-start">
          <h2>Time to play.</h2>
          <p className="ttb-practice-intro">
            {eligible.length === 0
              ? myKnown.length === 0
                ? "Add some known tunes to your book first."
                : "No known tunes of that type yet."
              : `A tune will be drawn at random from your ${eligible.length} eligible tune${eligible.length === 1 ? "" : "s"}.`}
          </p>
          <button
            className="ttb-big-btn"
            onClick={drawTune}
            disabled={eligible.length === 0}
          >
            Draw a tune
          </button>
        </div>
      ) : (
        <div className="ttb-practice-card">
          <div className="ttb-practice-meta">
            <span>{effectiveCurrent.type}</span>
            <span className="sep">·</span>
            <span>{effectiveCurrent.musicalKey || "—"}</span>
            <span className="sep">·</span>
            <span>last played {formatAgo(effectiveCurrent.lastPracticed)}</span>
          </div>
          <h2 className="ttb-practice-name">{effectiveCurrent.name}</h2>
          {effectiveCurrent.notes && (
            <p className="ttb-practice-notes">{effectiveCurrent.notes}</p>
          )}
          <div className="ttb-practice-links">
            {effectiveCurrent.sessionOrgId && (
              <a
                href={`https://thesession.org/tunes/${effectiveCurrent.sessionOrgId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open on thesession.org ↗
              </a>
            )}
            {effectiveCurrent.recordingUrl && (
              <a
                href={effectiveCurrent.recordingUrl}
                target="_blank"
                rel="noreferrer"
              >
                Recording ↗
              </a>
            )}
          </div>
          <div className="ttb-practice-actions">
            <button className="ttb-secondary" onClick={skipCurrent}>
              Skip for now
            </button>
            <button className="ttb-secondary" onClick={markPracticed}>
              Mark as practiced
            </button>
            <button className="ttb-big-btn" onClick={drawTune}>
              Next tune →
            </button>
          </div>
          {availableCount <= 1 && (
            <div className="ttb-practice-hint">Last one before skip pile resets.</div>
          )}
        </div>
      )}
    </div>
  );
}
