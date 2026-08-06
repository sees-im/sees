import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  decryptShare,
  formatRemaining,
  parseShareFragment,
  type ParsedShareLink,
  type SharePayload,
} from "@/lib/share";
import { PasswordInput } from "@/components/PasswordInput";
import { getShareStatus } from "@/lib/storj.functions";

export const Route = createFileRoute("/s")({
  component: SharedPage,
  head: () => ({
    meta: [{ title: "Shared Note · SEES" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

function SharedPage() {
  const [parsed, setParsed] = useState<ParsedShareLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const frag = typeof window !== "undefined" ? window.location.hash : "";
        if (!frag || frag === "#") {
          setError("This share link is missing its payload.");
          return;
        }
        const p = parseShareFragment(frag);
        // Pre-decryption revocation check (only for new-format shares).
        if (p.shareId) {
          try {
            const status = await getShareStatus({ data: { shareId: p.shareId } });
            if (status.revoked) {
              setError("This share has been revoked by the owner.");
              return;
            }
          } catch {
            // network failure — fail open so the link still works offline-ish
          }
        }
        setParsed(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid share link");
      }
    })();
  }, []);

  // auto-decrypt for open shares
  useEffect(() => {
    if (!parsed || parsed.mode !== "open" || payload) return;
    (async () => {
      try {
        const p = await decryptShare(parsed);
        if (p.exp !== null && p.exp < Date.now()) {
          setError("This shared note has expired.");
          return;
        }
        setPayload(p);
      } catch {
        setError("Could not decrypt this share.");
      }
    })();
  }, [parsed, payload]);

  const tryPassword = async () => {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const p = await decryptShare(parsed, password);
      if (p.exp !== null && p.exp < Date.now()) {
        setError("This shared note has expired.");
        setBusy(false);
        return;
      }
      setPayload(p);
    } catch {
      setError("Wrong password.");
    } finally {
      setBusy(false);
    }
  };

  const remaining = useMemo(() => (payload ? formatRemaining(payload.exp) : ""), [payload]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-xs uppercase tracking-widest text-accent">
          ← SEES
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Zero-knowledge share
        </span>
      </header>

      <main className="flex-1 px-6 py-10 max-w-3xl w-full mx-auto">
        {error && (
          <div className="border border-destructive/50 bg-destructive/10 text-destructive font-mono text-xs uppercase tracking-widest p-4 mb-6">
            {error}
          </div>
        )}

        {!payload && parsed?.mode === "password" && !error && (
          <div className="border border-border bg-surface p-6 max-w-md mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Password required
            </div>
            <h1 className="text-xl font-semibold mb-4">Locked share</h1>
            <PasswordInput
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") tryPassword();
              }}
              placeholder="Enter password..."
              className="w-full bg-background border border-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-accent mb-3"
            />
            <button
              onClick={tryPassword}
              disabled={busy || !password}
              className="w-full px-4 py-2 bg-accent text-accent-foreground font-mono text-xs uppercase tracking-widest font-bold hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Decrypting..." : "Unlock"}
            </button>
          </div>
        )}

        {!payload && parsed?.mode === "open" && !error && (
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center py-20">
            Decrypting…
          </div>
        )}

        {payload && (
          <article>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-3 flex-wrap">
              <span>Shared note</span>
              <span
                className={
                  payload.exp && payload.exp - Date.now() < 3_600_000
                    ? "text-destructive"
                    : "text-accent"
                }
              >
                · {remaining}
              </span>
              {payload.tags.length > 0 && (
                <span className="ml-auto flex gap-1 flex-wrap">
                  {payload.tags.map((t) => (
                    <span key={t} className="border border-accent/40 text-accent px-1.5 py-0.5">
                      #{t}
                    </span>
                  ))}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6">
              {payload.title || "Untitled"}
            </h1>
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="px-5 py-2 bg-accent text-accent-foreground font-mono text-xs uppercase tracking-widest font-bold hover:brightness-110"
              >
                Reveal contents
              </button>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed border border-border bg-surface/40 p-4">
                {payload.body}
              </pre>
            )}
            {revealed && (
              <div className="mt-4 flex gap-3 flex-wrap">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(payload.body).catch(() => {});
                  }}
                  className="px-4 py-2 border border-border font-mono text-xs uppercase tracking-widest hover:border-accent hover:text-accent"
                >
                  Copy body
                </button>
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
