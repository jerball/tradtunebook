import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../db/index.js";
import { tuneOps } from "../db/ops.js";
import { TUNE_TYPES } from "../lib/constants.js";
import { findPeerMatches, whoElseHas } from "../lib/grouping.js";
import { Avatar, AvatarStack } from "./Avatar.jsx";

export function TuneEditor({ tuneId, tunes, profiles, currentUserId, onDone }) {
  const isNew = !tuneId;
  const existing = tuneId ? tunes.find((t) => t.id === tuneId) : null;
  const isMine = !existing || existing.ownerId === currentUserId;

  const [form, setForm] = useState(() =>
    existing ?? {
      name: "",
      type: "reel",
      musicalKey: "",
      status: "learning",
      notes: "",
      recordingUrl: ""
    }
  );
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (firstInputRef.current && !existing) firstInputRef.current.focus();
  }, [existing]);

  const profileByUserId = useMemo(() => {
    const m = new Map();
    for (const p of profiles) m.set(p.userId, p);
    return m;
  }, [profiles]);

  const otherProfiles = useMemo(() => {
    if (!existing) return [];
    return whoElseHas(existing, tunes)
      .map((id) => profileByUserId.get(id))
      .filter(Boolean);
  }, [existing, tunes, profileByUserId]);

  // Peer-match suggestion as the user types a new tune name
  const peerMatches = useMemo(() => {
    if (!isNew) return [];
    return findPeerMatches(form.name, currentUserId, tunes);
  }, [isNew, form.name, currentUserId, tunes]);

  const peerProfiles = useMemo(() => {
    const uniq = new Map();
    for (const t of peerMatches) {
      const p = profileByUserId.get(t.ownerId);
      if (p) uniq.set(p.userId, p);
    }
    return Array.from(uniq.values());
  }, [peerMatches, profileByUserId]);

  const sessionCandidates = existing?.sessionOrgCandidates ?? null;

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const useTheirDetails = () => {
    const sample = peerMatches[0];
    if (!sample) return;
    update({ type: sample.type, musicalKey: sample.musicalKey || "" });
  };

  const pickCandidate = async (candidate) => {
    if (!existing) return;
    const patch = {
      sessionOrgId: candidate.id,
      sessionOrgMatchStatus: "matched",
      sessionOrgManual: true,
      sessionOrgCandidates: null
    };
    await db.tunes.update(existing.id, patch);
    setForm((f) => ({ ...f, ...patch }));
  };

  const setManualLink = async () => {
    if (!existing) return;
    const current = existing.sessionOrgId
      ? `https://thesession.org/tunes/${existing.sessionOrgId}`
      : "";
    const input = window.prompt(
      "Paste the correct thesession.org URL (or just the tune ID number):",
      current
    );
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed) {
      const patch = {
        sessionOrgId: null,
        sessionOrgMatchStatus: "unmatched",
        sessionOrgManual: true,
        sessionOrgCandidates: null
      };
      await db.tunes.update(existing.id, patch);
      setForm((f) => ({ ...f, ...patch }));
      return;
    }
    const match = trimmed.match(/tunes\/(\d+)/) || trimmed.match(/^(\d+)$/);
    if (!match) {
      alert(
        "Couldn't find a tune ID in that input. Expected something like https://thesession.org/tunes/1234 or just 1234."
      );
      return;
    }
    const patch = {
      sessionOrgId: match[1],
      sessionOrgMatchStatus: "matched",
      sessionOrgManual: true,
      sessionOrgCandidates: null
    };
    await db.tunes.update(existing.id, patch);
    setForm((f) => ({ ...f, ...patch }));
  };

  const reSearch = async () => {
    if (!existing) return;
    const patch = {
      sessionOrgId: null,
      sessionOrgMatchStatus: "pending",
      sessionOrgManual: false,
      sessionOrgCandidates: null
    };
    await db.tunes.update(existing.id, patch);
    setForm((f) => ({ ...f, ...patch }));
  };

  const save = async () => {
    if (!form.name.trim()) return;
    if (isNew) {
      // If a peer already has this tune matched, inherit their session.org ID
      const matchedPeer = peerMatches.find(
        (p) => p.sessionOrgMatchStatus === "matched"
      );
      await tuneOps.create(currentUserId, {
        ...form,
        sessionOrgId: matchedPeer?.sessionOrgId ?? null,
        sessionOrgMatchStatus: matchedPeer ? "matched" : "pending"
      });
    } else {
      await tuneOps.update(existing.id, form);
    }
    onDone();
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm(`Remove "${existing.name}" from your book?`)) return;
    await tuneOps.remove(existing.id);
    onDone();
  };

  const copyToMine = async () => {
    if (!existing) return;
    await tuneOps.copyFromPeer(existing, currentUserId);
    onDone();
  };

  const readOnly = !isMine && !isNew;
  const ownerProfile = existing ? profileByUserId.get(existing.ownerId) : null;

  return (
    <div className="ttb-edit">
      <h2>{isNew ? "Add a tune" : isMine ? "Edit tune" : "View tune"}</h2>

      {readOnly && ownerProfile && (
        <div className="ttb-peer-banner">
          <Avatar profile={ownerProfile} />
          <span>
            This is in <strong>{ownerProfile.displayName}</strong>&rsquo;s tunebook. View only —{" "}
            <button onClick={copyToMine}>copy it to yours</button>.
          </span>
        </div>
      )}

      {otherProfiles.length > 0 && (
        <div className="ttb-also-in">
          <span>Also in the tunebooks of:</span>
          {otherProfiles.map((p) => (
            <span key={p.userId} className="ttb-also-in-tag">
              <Avatar profile={p} size="sm" />
              <span className="name">{p.displayName}</span>
            </span>
          ))}
        </div>
      )}

      {isNew && peerProfiles.length > 0 && form.name.length >= 3 && (
        <div className="ttb-suggestion">
          <AvatarStack profiles={peerProfiles} max={4} />
          <span>
            {peerProfiles.length} other{peerProfiles.length === 1 ? "" : "s"} already have
            a tune by this name
          </span>
          <button onClick={useTheirDetails}>Use their details</button>
        </div>
      )}

      {sessionCandidates && sessionCandidates.length > 0 && isMine && !isNew && (
        <div className="ttb-suggestion">
          <span>Multiple matches on thesession.org — pick one:</span>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%", marginTop: "0.5rem" }}>
            {sessionCandidates.map((c) => (
              <button
                key={c.id}
                onClick={() => pickCandidate(c)}
                style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--rule)" }}
              >
                {c.name} ({c.type})
              </button>
            ))}
          </div>
        </div>
      )}

      {!isNew && isMine && existing?.sessionOrgMatchStatus === "matched" && (
        <div className="ttb-suggestion" style={{ background: "#eef3ee" }}>
          <span style={{ flex: 1 }}>
            Linked to{" "}
            <a
              href={`https://thesession.org/tunes/${existing.sessionOrgId}`}
              target="_blank"
              rel="noreferrer"
            >
              thesession.org/tunes/{existing.sessionOrgId}
            </a>
            {existing.sessionOrgManual ? " (manual)" : ""}
          </span>
          <button onClick={setManualLink} style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--rule)" }}>
            Fix link
          </button>
          <button onClick={reSearch} style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--rule)" }}>
            Re-search
          </button>
        </div>
      )}

      {!isNew && isMine && existing?.sessionOrgMatchStatus !== "matched" && (
        <div className="ttb-suggestion">
          <span style={{ flex: 1 }}>
            {existing?.sessionOrgMatchStatus === "pending"
              ? "Looking up on thesession.org…"
              : "No thesession.org match."}
          </span>
          <button onClick={setManualLink} style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--rule)" }}>
            Set link manually
          </button>
        </div>
      )}

      <label>
        <span className="field-label">Name</span>
        <input
          ref={firstInputRef}
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. The Humours of Tulla"
          disabled={readOnly}
        />
      </label>

      <div className="ttb-edit-row">
        <label>
          <span className="field-label">Type</span>
          <select
            value={form.type}
            onChange={(e) => update({ type: e.target.value })}
            disabled={readOnly}
          >
            {TUNE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Key</span>
          <input
            value={form.musicalKey}
            onChange={(e) => update({ musicalKey: e.target.value })}
            placeholder="D, Gmaj, Edor"
            disabled={readOnly}
          />
        </label>
        <label>
          <span className="field-label">Status</span>
          <select
            value={form.status}
            onChange={(e) => update({ status: e.target.value })}
            disabled={readOnly}
          >
            <option value="learning">Learning</option>
            <option value="know">Known</option>
          </select>
        </label>
      </div>

      <label>
        <span className="field-label">Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Phrasing reminders, where you learned it, who plays it…"
          rows={3}
          disabled={readOnly}
        />
      </label>

      <label>
        <span className="field-label">Recording URL</span>
        <input
          value={form.recordingUrl}
          onChange={(e) => update({ recordingUrl: e.target.value })}
          placeholder="https://…"
          disabled={readOnly}
        />
      </label>

      <div className="ttb-edit-actions">
        {isMine && !isNew && (
          <button className="ttb-danger" onClick={remove}>
            Remove
          </button>
        )}
        <button className="ttb-secondary" onClick={onDone}>
          {readOnly ? "Back" : "Cancel"}
        </button>
        {!readOnly && (
          <button
            className="ttb-big-btn"
            onClick={save}
            disabled={!form.name.trim()}
          >
            {isNew ? "Add to tunebook" : "Save changes"}
          </button>
        )}
      </div>
    </div>
  );
}