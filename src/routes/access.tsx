import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Check, KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { PasswordInput } from "@/components/PasswordInput";
import { nameId, passphraseStrength } from "@/lib/crypto";
import { checkStorjName } from "@/lib/storj.functions";
import { useVault } from "@/lib/vault-context";
import { Turnstile } from "@/components/Turnstile";
import { TwoFactorInput } from "@/components/TwoFactorInput";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Unlock or Create a Vault — SEES" },
      {
        name: "description",
        content:
          "Enter your Vault ID and passphrase to unlock your encrypted notes, or create a new zero-knowledge vault. No email required.",
      },
      { property: "og:title", content: "Unlock or Create a Vault — SEES" },
      {
        property: "og:description",
        content: "No email required. Your passphrase never leaves your device.",
      },
      { property: "og:url", content: "https://www.sees.im/access" },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/access" }],
  }),
  validateSearch: (search: Record<string, unknown>): { mode?: "create" } =>
    search.mode === "create" ? { mode: "create" } : {},
  component: AccessPage,
});

const NAME_RE = /^[a-z0-9_.-]{1,64}$/;
type NameStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

function AccessPage() {
  const { hasVault, isLocked, createVault, unlock } = useVault();
  const navigate = useNavigate();
  const { mode: requestedMode } = Route.useSearch();
  const [mode, setMode] = useState<"unlock" | "create">(
    requestedMode === "create" ? "create" : "unlock",
  );
  const [vaultName, setVaultName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorInvalid, setTwoFactorInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Turnstile tokens are single-use. Bumping this after every attempt forces a
  // fresh one, so retries are not rejected as spent.
  const [turnstileNonce, setTurnstileNonce] = useState(0);

  useEffect(() => {
    if (requestedMode === "create") return;
    setMode("unlock");
  }, [hasVault, requestedMode]);

  useEffect(() => {
    if (!isLocked) navigate({ to: "/vault" });
  }, [isLocked, navigate]);

  useEffect(() => {
    if (mode !== "create") {
      setNameStatus("idle");
      return;
    }
    const name = vaultName.trim();
    if (!name) {
      setNameStatus("idle");
      return;
    }
    if (!NAME_RE.test(name)) {
      setNameStatus("invalid");
      return;
    }
    setNameStatus("checking");
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkStorjName({ data: { nameId: await nameId(name) } });
        if (!cancelled) setNameStatus(result.taken ? "taken" : "available");
      } catch {
        if (!cancelled) setNameStatus("error");
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [vaultName, mode]);

  const strength = passphraseStrength(passphrase);

  const selectMode = (nextMode: "unlock" | "create") => {
    setMode(nextMode);
    setError(null);
    setPassphrase("");
    setConfirm("");
    setTwoFactorCode("");
    setTwoFactorRequired(false);
    setTwoFactorInvalid(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!passphrase) return;
    if (!vaultName.trim()) {
      setError("Vault ID is required.");
      return;
    }
    if (!NAME_RE.test(vaultName.trim().toLowerCase())) {
      setError("Use 1–64 lowercase letters, numbers, dots, dashes, or underscores.");
      return;
    }
    if (!turnstileToken) {
      setError("Complete the verification check below.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        if (!strength.ok) {
          setError("Use at least 3 characters.");
          return;
        }
        if (passphrase !== confirm) {
          setError("Passphrases do not match.");
          return;
        }
        await createVault(vaultName, passphrase, turnstileToken);
        toast.success("Vault created", {
          description: "Your encrypted vault is sealed and ready.",
        });
      } else {
        const result = await unlock(vaultName, passphrase, turnstileToken, twoFactorCode);
        if (!result.ok) {
          if (result.reason === "two-factor-required") {
            setTwoFactorRequired(true);
            setTwoFactorInvalid(false);
            setError(null);
            return;
          }
          if (result.reason === "two-factor-invalid") {
            setTwoFactorRequired(true);
            setTwoFactorInvalid(true);
            setTwoFactorCode("");
            setError(null);
            return;
          }
          if (result.reason === "not-found") {
            setError(
              "No vault found for that Vault ID. Check the spelling — the ID is part of how your vault is located.",
            );
            return;
          }
          setError("That Vault ID and passphrase could not decrypt a vault.");
          return;
        }
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
      setTurnstileNonce((n) => n + 1);
    }
  };

  return (
    <main className="access-page">
      <div className="access-page__glow" aria-hidden />

      <header className="access-page__header">
        <Link to="/" className="brand-lockup" aria-label="SEES home">
          <BrandMark variant="wordmark" />
        </Link>
        <Link to="/" className="access-back">
          <ArrowLeft className="size-3.5" />
          Back to overview
        </Link>
      </header>

      <div className="access-page__layout">
        <section className="access-page__intro">
          <div className="eyebrow-pill">
            <span className="status-pulse" />
            Zero-knowledge gateway
          </div>
          <h1>
            Private
            <span>entry.</span>
          </h1>
          <p>
            The key is created here, used here, and stays here. SEES only receives what your browser
            has already encrypted.
          </p>
          <div className="access-assurances">
            <span>
              <Check className="size-3.5" /> No email or account
            </span>
            <span>
              <Check className="size-3.5" /> No recovery backdoor
            </span>
            <span>
              <Check className="size-3.5" /> No key leaves this device
            </span>
          </div>
        </section>

        <div className="access-page__card-wrap">
          <div className="access-orbit access-orbit--one" aria-hidden />
          <div className="access-orbit access-orbit--two" aria-hidden />
          <VaultForm
            mode={mode}
            setMode={selectMode}
            vaultName={vaultName}
            setVaultName={setVaultName}
            passphrase={passphrase}
            setPassphrase={setPassphrase}
            confirm={confirm}
            setConfirm={setConfirm}
            twoFactorCode={twoFactorCode}
            setTwoFactorCode={setTwoFactorCode}
            twoFactorRequired={twoFactorRequired}
            twoFactorInvalid={twoFactorInvalid}
            nameStatus={nameStatus}
            strength={strength}
            error={error}
            busy={busy}
            handleSubmit={handleSubmit}
            turnstileToken={turnstileToken}
            setTurnstileToken={setTurnstileToken}
            turnstileNonce={turnstileNonce}
          />
        </div>
      </div>

      <div className="access-page__footer">
        <span>
          <ShieldCheck className="size-3.5 text-brand" /> AES-256-GCM
        </span>
        <span>Session / locally sealed</span>
      </div>
    </main>
  );
}

function VaultForm({
  mode,
  setMode,
  vaultName,
  setVaultName,
  passphrase,
  setPassphrase,
  confirm,
  setConfirm,
  twoFactorCode,
  setTwoFactorCode,
  twoFactorRequired,
  twoFactorInvalid,
  nameStatus,
  strength,
  error,
  busy,
  handleSubmit,
  turnstileToken,
  setTurnstileToken,
  turnstileNonce,
}: {
  mode: "unlock" | "create";
  setMode: (mode: "unlock" | "create") => void;
  vaultName: string;
  setVaultName: (value: string) => void;
  passphrase: string;
  setPassphrase: (value: string) => void;
  confirm: string;
  setConfirm: (value: string) => void;
  twoFactorCode: string;
  setTwoFactorCode: (value: string) => void;
  twoFactorRequired: boolean;
  twoFactorInvalid: boolean;
  nameStatus: NameStatus;
  strength: ReturnType<typeof passphraseStrength>;
  error: string | null;
  busy: boolean;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  turnstileToken: string | null;
  setTurnstileToken: (token: string | null) => void;
  turnstileNonce: number;
}) {
  const statusLabel: Record<Exclude<NameStatus, "idle">, string> = {
    invalid: "Invalid format",
    checking: "Checking…",
    available: "Available",
    taken: "Already claimed",
    error: "Check unavailable",
  };

  return (
    <form onSubmit={handleSubmit} className="access-card access-card--standalone">
      <div className="access-card__head">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            Secure access
          </p>
          <h2>{mode === "unlock" ? "Welcome back." : "Claim your vault."}</h2>
        </div>
        <div className="access-status">
          <span className="status-pulse" /> E2E
        </div>
      </div>

      <div className="mode-tabs" role="tablist" aria-label="Vault access mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "unlock"}
          onClick={() => setMode("unlock")}
          className={mode === "unlock" ? "is-active" : ""}
        >
          Unlock
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          onClick={() => setMode("create")}
          className={mode === "create" ? "is-active" : ""}
        >
          Create
        </button>
      </div>

      <div className="field-group">
        <div className="field-label-row">
          <label htmlFor="vault-id">Vault ID</label>
          {mode === "create" && nameStatus !== "idle" && (
            <span className={`name-status name-status--${nameStatus}`}>
              {statusLabel[nameStatus]}
            </span>
          )}
        </div>
        <input
          id="vault-id"
          type="text"
          value={vaultName}
          onChange={(event) => setVaultName(event.target.value.toLowerCase())}
          placeholder="your-vault-name"
          autoComplete="username"
          spellCheck={false}
          autoFocus
        />
      </div>

      <div className="field-group">
        <div className="field-label-row">
          <label htmlFor="master-passphrase">Master passphrase</label>
          {mode === "create" && passphrase && (
            <span className="entropy-label">{strength.label}</span>
          )}
        </div>
        <PasswordInput
          id="master-passphrase"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder="Enter your private passphrase"
          autoComplete={mode === "unlock" ? "current-password" : "new-password"}
        />
        {mode === "create" && passphrase && (
          <div className="entropy-meter" aria-label={`Passphrase strength: ${strength.label}`}>
            {[0, 1, 2, 3].map((level) => (
              <span className={level < strength.score ? "is-filled" : ""} key={level} />
            ))}
          </div>
        )}
      </div>

      {mode === "create" && (
        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="confirm-passphrase">Confirm passphrase</label>
          </div>
          <PasswordInput
            id="confirm-passphrase"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Repeat your passphrase"
            autoComplete="new-password"
          />
        </div>
      )}

      {/* Deliberately no `field-group` wrapper: `.field-group input` is more
          specific than `.tfa__cell` and would clobber the cell sizing, padding
          and font size — which hid the digits entirely. */}
      {mode === "unlock" && twoFactorRequired && (
        <TwoFactorInput
          value={twoFactorCode}
          onChange={setTwoFactorCode}
          invalid={twoFactorInvalid}
          disabled={busy}
        />
      )}

      <div className="field-group">
        <Turnstile onVerify={setTurnstileToken} resetSignal={turnstileNonce} />
      </div>

      {error && (
        <p className="access-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          busy ||
          !passphrase ||
          !vaultName.trim() ||
          (mode === "unlock" && twoFactorRequired && twoFactorCode.length !== 6) ||
          (mode === "create" && nameStatus !== "available") ||
          !turnstileToken
        }
        className="access-submit"
      >
        <span>
          {busy
            ? "Deriving private key…"
            : mode === "create"
              ? "Create my vault"
              : "Unlock my vault"}
        </span>
        {busy ? <span className="submit-loader" /> : <ArrowUpRight className="size-4" />}
      </button>
      <p className="access-note">
        <KeyRound className="size-3.5" />
        {mode === "create"
          ? "There is no recovery. Store your passphrase somewhere safe."
          : "Your passphrase stays inside this browser."}
      </p>
    </form>
  );
}
