import { useEffect, useState } from "react";
import { useLiveQuery, useObservable } from "dexie-react-hooks";
import { db } from "./db/index.js";
import { ensureSharedRealm, getSharedRealmId, inviteToSharedRealm } from "./db/bootstrap.js";
import { useCurrentUser } from "./hooks/useCurrentUser.js";
import { useOnlineStatus } from "./hooks/useOnlineStatus.js";
import { installQueueRunner } from "./session-org/queue.js";
import { Avatar } from "./components/Avatar.jsx";
import { TuneList } from "./components/TuneList.jsx";
import { Practice } from "./components/Practice.jsx";
import { TuneEditor } from "./components/TuneEditor.jsx";

export default function App() {
  const [screen, setScreen] = useState("list"); // list | practice | edit
  const [editingId, setEditingId] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { userId, profile, user, login, logout } = useCurrentUser();
  const isOnline = useOnlineStatus();

  // Install the session.org enrichment queue once
  useEffect(() => {
    installQueueRunner();
  }, []);

  // Bootstrap the shared realm as soon as we have a logged-in user.
  // Safe to call repeatedly — only creates if one doesn't exist yet.
  useEffect(() => {
    if (!user?.isLoggedIn) return;
    ensureSharedRealm().catch((err) => {
      // First user creates the realm; later users will see it via their invite acceptance.
      // A "not-permitted" error just means someone else already created it.
      console.log("Shared realm bootstrap:", err.message);
    });
  }, [user?.isLoggedIn]);

  // Live queries — automatically re-run when the DB changes
  const tunes = useLiveQuery(() => db.tunes.orderBy("name").toArray(), []);
  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const invites = useObservable(db.cloud?.invites) ?? [];
  const sharedRealmId = useLiveQuery(() => getSharedRealmId(), []);

  const loading = !tunes || !profiles || !userId || !profile;
  if (loading) {
    return (
      <>
        <AppHeader online={isOnline} profile={profile} />
        <div className="ttb-loading">Opening the tunebook…</div>
      </>
    );
  }

  const pendingCount = tunes.filter((t) => t.sessionOrgMatchStatus === "pending").length;
  const pendingInvites = (invites || []).filter((i) => !i.accepted && !i.rejected);

  return (
    <>
      <AppHeader
        online={isOnline}
        profile={profile}
        pendingCount={pendingCount}
        cloudUser={user}
        onLogin={login}
        onLogout={logout}
        onOpenInvite={() => setInviteOpen(true)}
        showInvite={!!sharedRealmId && !!user?.isLoggedIn}
      />

      {pendingInvites.length > 0 && (
        <InviteBanner invites={pendingInvites} />
      )}

      <nav className="ttb-nav">
        <button
          className={screen === "list" ? "active" : ""}
          onClick={() => { setScreen("list"); setEditingId(null); }}
        >
          Tunebook
        </button>
        <button
          className={screen === "practice" ? "active" : ""}
          onClick={() => { setScreen("practice"); setEditingId(null); }}
        >
          Practice
        </button>
        <button
          className="ttb-add"
          onClick={() => { setEditingId(null); setScreen("edit"); }}
        >
          + Add a tune
        </button>
      </nav>

      <main>
        {screen === "list" && (
          <TuneList
            tunes={tunes}
            profiles={profiles}
            currentUserId={userId}
            onEdit={(id) => { setEditingId(id); setScreen("edit"); }}
          />
        )}
        {screen === "practice" && (
          <Practice tunes={tunes} currentUserId={userId} />
        )}
        {screen === "edit" && (
          <TuneEditor
            tuneId={editingId}
            tunes={tunes}
            profiles={profiles}
            currentUserId={userId}
            onDone={() => { setEditingId(null); setScreen("list"); }}
          />
        )}
      </main>

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
        />
      )}

      <footer className="ttb-foot">
        Local-first · {tunes.length} tune{tunes.length === 1 ? "" : "s"} ·{" "}
        {profiles.length} tunebook{profiles.length === 1 ? "" : "s"}
      </footer>
    </>
  );
}

function InviteBanner({ invites }) {
  return (
    <div className="ttb-invite-banner">
      {invites.map((inv) => (
        <div key={inv.id} className="ttb-invite-row">
          <span>
            <strong>{inv.realm?.name || "Someone"}</strong> invited you to join their shared tunebook.
          </span>
          <div className="ttb-invite-actions">
            <button className="ttb-secondary" onClick={() => inv.reject()}>Decline</button>
            <button className="ttb-big-btn" onClick={() => inv.accept()}>Accept</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function InviteModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await inviteToSharedRealm(email);
      setSent(true);
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ttb-modal-backdrop" onClick={onClose}>
      <div className="ttb-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Invite a friend</h2>
        <p className="ttb-modal-intro">
          They&rsquo;ll receive an email with a magic link. Once they sign in and accept,
          they&rsquo;ll see your shared tunebook.
        </p>
        <label>
          <span className="field-label">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
          />
        </label>
        {error && <p className="ttb-modal-error">{error}</p>}
        {sent && <p className="ttb-modal-sent">Invite sent. They&rsquo;ll get an email shortly.</p>}
        <div className="ttb-modal-actions">
          <button className="ttb-secondary" onClick={onClose}>Close</button>
          <button
            className="ttb-big-btn"
            onClick={send}
            disabled={sending || !email.trim()}
          >
            {sending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppHeader({ online, profile, pendingCount = 0, cloudUser, onLogin, onLogout, onOpenInvite, showInvite }) {
  return (
    <header className="ttb-header">
      <div className="ttb-brand">
        <div className="ttb-mark">❦</div>
        <div>
          <h1 className="ttb-title">Trad Tune Book</h1>
          <p className="ttb-sub">A keeper of tunes known &amp; tunes in hand</p>
        </div>
      </div>
      <div className="ttb-status">
        {profile && (
          <div className="ttb-user-switch" title={cloudUser?.email || "Local user"}>
            <Avatar profile={profile} />
            <span style={{ fontSize: "0.85rem" }}>{profile.displayName}</span>
            {cloudUser ? (
              <button
                onClick={onLogout}
                style={{
                  marginLeft: "0.4rem",
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em"
                }}
              >
                Log out
              </button>
            ) : onLogin ? (
              <button
                onClick={onLogin}
                style={{
                  marginLeft: "0.4rem",
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em"
                }}
              >
                Log in
              </button>
            ) : null}
          </div>
        )}
        <span className={`ttb-chip ${online ? "on" : "off"}`}>
          <span className="ttb-dot" /> {online ? "online" : "offline"}
        </span>
        {showInvite && (
          <button className="ttb-chip" onClick={onOpenInvite} title="Invite someone to your shared tunebook">
            + invite
          </button>
        )}
        {pendingCount > 0 && (
          <span className="ttb-pending-label">{pendingCount} queued</span>
        )}
      </div>
    </header>
  );
}
