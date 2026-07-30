import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Lock, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Turnstile } from "@/components/Turnstile";
import {
  adminLogin,
  adminLogout,
  checkAdminAuth,
  getAdminStats,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — SEES" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [vaultCount, setVaultCount] = useState<number | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAuth()
      .then((result) => setAuthed(result.authed))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    getAdminStats()
      .then((result) => setVaultCount(result.vaultCount))
      .catch(() => setError("Could not load stats."));
  }, [authed]);

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!turnstileToken) {
      setError("Complete the verification check below.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await adminLogin({ data: { password, turnstileToken } });
      if (result.ok) {
        setAuthed(true);
        setPassword("");
      } else if (result.reason === "locked") {
        setError("Too many failed attempts. Try again in 15 minutes.");
      } else if (result.reason === "bot") {
        setError("Verification failed. Try again.");
      } else {
        setError("Wrong password.");
      }
    } catch {
      setError("Could not sign in. Try again.");
    } finally {
      setBusy(false);
      setTurnstileToken(null);
    }
  };

  const handleLogout = async () => {
    await adminLogout().catch(() => {});
    setAuthed(false);
    setVaultCount(null);
  };

  return (
    <main className="admin-page">
      <div className="admin-card">
        <BrandMark variant="wordmark" className="admin-card__brand" />

        {checking ? (
          <p className="admin-note">
            <Loader2 className="size-3.5 animate-spin" style={{ display: "inline", marginRight: 6 }} />
            Checking session…
          </p>
        ) : !authed ? (
          <form onSubmit={submitLogin} className="admin-login">
            <label htmlFor="admin-password">
              <Lock className="size-3.5" />
              Admin password
            </label>
            <input
              id="admin-password"
              type="password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
            <Turnstile onVerify={setTurnstileToken} />
            {error && <p className="admin-error">{error}</p>}
            <button type="submit" disabled={busy || !password || !turnstileToken} className="admin-submit">
              {busy ? "Checking…" : "Sign in"}
            </button>
          </form>
        ) : (
          <div className="admin-stats">
            <div className="admin-stat">
              <span>Vaults created</span>
              <strong>{vaultCount === null ? "—" : vaultCount.toLocaleString()}</strong>
            </div>
            {error && <p className="admin-error">{error}</p>}
            <button type="button" className="admin-logout" onClick={handleLogout}>
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
