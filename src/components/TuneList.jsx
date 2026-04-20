import { useMemo, useState } from "react";
import { TUNE_TYPES } from "../lib/constants.js";
import { whoElseHas } from "../lib/grouping.js";
import { Avatar, AvatarStack } from "./Avatar.jsx";

export function TuneList({ tunes, profiles, currentUserId, onEdit }) {
  const [scope, setScope] = useState("mine");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const profileByUserId = useMemo(() => {
    const m = new Map();
    for (const p of profiles) m.set(p.userId, p);
    return m;
  }, [profiles]);

  const visible = useMemo(() => {
    let base = tunes;
    if (scope === "mine") base = base.filter((t) => t.ownerId === currentUserId);
    return base.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterType !== "all" && t.type !== filterType) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tunes, scope, filterStatus, filterType, search, currentUserId]);

  const mine = tunes.filter((t) => t.ownerId === currentUserId);
  const knowCount = mine.filter((t) => t.status === "know").length;
  const learnCount = mine.filter((t) => t.status === "learning").length;

  const countStr =
    scope === "mine"
      ? `Showing ${visible.length} of ${mine.length} yours · ${knowCount} known · ${learnCount} learning`
      : `Showing ${visible.length} of ${tunes.length} across ${profiles.length} tunebook${profiles.length === 1 ? "" : "s"}`;

  return (
    <div>
      <div className="ttb-controls">
        <div className="ttb-controls-row">
          <div className="ttb-scope-toggle">
            <button
              className={scope === "mine" ? "active" : ""}
              onClick={() => setScope("mine")}
            >
              My tunes
            </button>
            <button
              className={scope === "all" ? "active" : ""}
              onClick={() => setScope("all")}
            >
              All tunes
            </button>
          </div>
          <input
            className="ttb-search"
            placeholder="Search tunes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ttb-controls-row">
          <div className="ttb-filter-group">
            {["all", "know", "learning"].map((s) => (
              <button
                key={s}
                className={filterStatus === s ? "active" : ""}
                onClick={() => setFilterStatus(s)}
              >
                {s === "all" ? "All" : s === "know" ? "Known" : "Learning"}
              </button>
            ))}
          </div>
          <select
            className="ttb-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All types</option>
            {TUNE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="ttb-count">{countStr}</div>
      </div>

      {visible.length === 0 ? (
        <div className="ttb-empty">No tunes match. Try a different filter.</div>
      ) : (
        <ol className="ttb-table">
          <li className="ttb-row ttb-row-head">
            <span className="c-name">Tune</span>
            <span className="c-type">Type</span>
            <span className="c-key">Key</span>
            <span className="c-status">Status</span>
            <span className="c-also-in">Also in</span>
            <span className="c-links">Links</span>
          </li>
          {visible.map((t) => {
            const otherOwnerIds = whoElseHas(t, tunes);
            const otherProfiles = otherOwnerIds
              .map((id) => profileByUserId.get(id))
              .filter(Boolean);
            const ownerProfile = profileByUserId.get(t.ownerId);
            const isMine = t.ownerId === currentUserId;
            return (
              <li
                key={t.id}
                className="ttb-row"
                onClick={() => onEdit(t.id)}
              >
                <span className="c-name">
                  {scope === "all" && !isMine && <Avatar profile={ownerProfile} size="sm" />}
                  <span className="tune-name">
                    {t.name}
                    {t.notes && <span className="tune-note-mark">·</span>}
                  </span>
                </span>
                <span className="c-type"><em>{t.type}</em></span>
                <span className="c-key">{t.musicalKey}</span>
                <span className="c-status">
                  <span className={`pill pill-${t.status}`}>{t.status}</span>
                </span>
                <span className="c-also-in">
                  {otherProfiles.length > 0 ? (
                    <AvatarStack profiles={otherProfiles} max={4} />
                  ) : (
                    <span className="none">—</span>
                  )}
                </span>
                <span className="c-links" onClick={(e) => e.stopPropagation()}>
                  <LinkCell tune={t} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function LinkCell({ tune }) {
  const bits = [];
  if (tune.sessionOrgMatchStatus === "matched" && tune.sessionOrgId) {
    bits.push(
      <a
        key="so"
        className="link-session"
        href={`https://thesession.org/tunes/${tune.sessionOrgId}`}
        target="_blank"
        rel="noreferrer"
      >
        session.org →
      </a>
    );
  } else if (tune.sessionOrgMatchStatus === "pending") {
    bits.push(<span key="p" className="link-pending">looking up…</span>);
  } else if (tune.sessionOrgMatchStatus === "ambiguous") {
    bits.push(<span key="a" className="link-ambiguous" title="Multiple matches — open tune to choose">choose match</span>);
  } else if (tune.sessionOrgMatchStatus === "no_match") {
    bits.push(<span key="n" className="link-nomatch">no match</span>);
  }
  if (tune.recordingUrl) {
    bits.push(
      <a
        key="rec"
        className="link-rec"
        href={tune.recordingUrl}
        target="_blank"
        rel="noreferrer"
        title="Recording"
      >
        ♪
      </a>
    );
  }
  return <>{bits}</>;
}
