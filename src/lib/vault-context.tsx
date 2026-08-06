import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  deriveKey,
  encryptString,
  decryptString,
  fingerprint,
  lookupId,
  nameId,
  randomBytes,
  b64,
  passphraseStrength,
  PBKDF2_ITERATIONS_DEFAULT,
  PBKDF2_ITERATIONS_LEGACY,
  VAULT_META_KEY,
  VERIFIER_PLAINTEXT,
  type VaultMeta,
} from "./crypto";
import {
  getStorjMeta,
  putStorjMeta,
  claimStorjName,
  deleteStorjMeta,
  deleteStorjName,
  deleteStorjAudit,
  purgeStorjVault,
  getStorjAudit,
  putStorjAudit,
  getClientInfo,
  listStorjNotes,
  putStorjNote,
  deleteStorjNote,
} from "./storj.functions";
import { createLocalVaultStorage } from "./storage";
import { verifyTotpCode } from "./totp";

export type VaultStorageMode = "storj" | "local";

export interface AuditEntry {
  ts: number;
  ua: string;
  ip: string;
  country?: string;
  event: "create" | "unlock" | "passphrase-change";
}

export type UnlockResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid" | "not-found" | "two-factor-required" | "two-factor-invalid";
    };

interface VaultContextValue {
  isLocked: boolean;
  hasVault: boolean;
  fingerprint: string | null;
  vaultName: string | null;
  storageMode: VaultStorageMode;
  sessionTimeoutMinutes: number | "never";
  twoFactorEnabled: boolean;
  key: CryptoKey | null;
  createVault: (vaultName: string, passphrase: string, turnstileToken: string) => Promise<void>;
  createDemoVault: (vaultName: string, passphrase: string) => Promise<void>;
  unlock: (
    vaultName: string,
    passphrase: string,
    turnstileToken: string,
    twoFactorCode?: string,
  ) => Promise<UnlockResult>;
  enableTwoFactor: (secret: string, code: string) => Promise<void>;
  disableTwoFactor: (code: string) => Promise<void>;
  changePassphrase: (oldPassphrase: string, newPassphrase: string) => Promise<void>;
  loadAudit: () => Promise<AuditEntry[]>;
  setSessionTimeoutMinutes: (value: number | "never") => void;
  lock: () => void;
  destroyVault: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);
const VAULT_NAME_KEY = "krypta:vault-name";
const VAULT_STORAGE_MODE_KEY = "krypta:storage-mode";
const SESSION_TIMEOUT_KEY = "krypta:session-timeout-minutes";
const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;
const SESSION_TIMEOUT_OPTIONS = new Set([5, 15, 30, 60, 120]);

function readMeta(): VaultMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VAULT_META_KEY);
    return raw ? (JSON.parse(raw) as VaultMeta) : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: VaultMeta) {
  window.localStorage.setItem(VAULT_META_KEY, JSON.stringify(meta));
}

function readSessionTimeout(): number | "never" {
  if (typeof window === "undefined") return DEFAULT_SESSION_TIMEOUT_MINUTES;
  const raw = window.localStorage.getItem(SESSION_TIMEOUT_KEY);
  if (raw === "never") return "never";
  const parsed = Number(raw);
  return SESSION_TIMEOUT_OPTIONS.has(parsed) ? parsed : DEFAULT_SESSION_TIMEOUT_MINUTES;
}

async function readAuditFromStorj(key: CryptoKey, vaultId: string): Promise<AuditEntry[]> {
  try {
    const { blob } = await getStorjAudit({ data: { vaultId } });
    if (!blob) return [];
    const json = await decryptString(key, blob);
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.slice(-50) : [];
  } catch {
    return [];
  }
}

async function writeAuditToStorj(key: CryptoKey, vaultId: string, entries: AuditEntry[]) {
  const trimmed = entries.slice(-50);
  const blob = await encryptString(key, JSON.stringify(trimmed));
  await putStorjAudit({ data: { vaultId, blob } });
}

async function appendAuditEvent(key: CryptoKey, vaultId: string, event: AuditEntry["event"]) {
  try {
    let ip = "unknown";
    let country = "";
    try {
      const info = await getClientInfo();
      ip = info.ip;
      country = info.country;
    } catch {
      // offline / blocked
    }
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "unknown";
    const existing = await readAuditFromStorj(key, vaultId);
    existing.push({ ts: Date.now(), ua, ip, country, event });
    await writeAuditToStorj(key, vaultId, existing);
  } catch (e) {
    console.warn("Audit append failed", e);
  }
}

async function syncMetaToStorj(
  vaultName: string | null,
  passphrase: string | null,
  meta: VaultMeta,
) {
  // Must throw, never no-op: callers like enableTwoFactor report success to the
  // user based on this resolving. Silently skipping the sync would leave 2FA on
  // locally but absent from Storj — off on every other device.
  if (!vaultName || !passphrase) {
    throw new Error("Vault session expired. Unlock again before changing security settings.");
  }
  const lid = await lookupId(vaultName, passphrase);
  await putStorjMeta({ data: { lookupId: lid, meta } });
}

async function reencryptTwoFactor(
  meta: VaultMeta,
  oldKey: CryptoKey,
  newKey: CryptoKey,
): Promise<VaultMeta["twoFactor"]> {
  if (!meta.twoFactor?.enabled) return undefined;
  const secret = await decryptString(oldKey, meta.twoFactor.secret);
  return {
    ...meta.twoFactor,
    secret: await encryptString(newKey, secret),
  };
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [fp, setFp] = useState<string | null>(null);
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<VaultStorageMode>("storj");
  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState<number | "never">(
    DEFAULT_SESSION_TIMEOUT_MINUTES,
  );
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const passphraseRef = useRef<string | null>(null);

  useEffect(() => {
    const meta = readMeta();
    setHasVault(!!meta);
    setTwoFactorEnabled(!!meta?.twoFactor?.enabled);
    try {
      setVaultName(window.localStorage.getItem(VAULT_NAME_KEY));
      setStorageMode(
        window.localStorage.getItem(VAULT_STORAGE_MODE_KEY) === "local" ? "local" : "storj",
      );
      setSessionTimeoutMinutesState(readSessionTimeout());
    } catch {
      // ignore
    }
  }, []);

  const setSessionTimeoutMinutes = useCallback((value: number | "never") => {
    const next =
      value === "never" || SESSION_TIMEOUT_OPTIONS.has(value)
        ? value
        : DEFAULT_SESSION_TIMEOUT_MINUTES;
    window.localStorage.setItem(SESSION_TIMEOUT_KEY, String(next));
    setSessionTimeoutMinutesState(next);
  }, []);

  const createVault = useCallback(
    async (name: string, passphrase: string, turnstileToken: string) => {
      const strength = passphraseStrength(passphrase);
      if (!strength.ok) {
        throw new Error("Passphrase too short. Use at least 3 characters.");
      }
      const nid = await nameId(name);
      const claim = await claimStorjName({ data: { nameId: nid, turnstileToken } });
      if (!claim.ok) {
        if (claim.reason === "error") {
          throw new Error("Couldn't reach the network to verify Vault ID. Try again.");
        }
        throw new Error("That Vault ID is already taken. Pick another.");
      }
      const salt = randomBytes(16);
      const iterations = PBKDF2_ITERATIONS_DEFAULT;
      const derived = await deriveKey(passphrase, salt, iterations);
      const verifier = await encryptString(derived, VERIFIER_PLAINTEXT);
      const meta: VaultMeta = { salt: b64.encode(salt), verifier, iterations };
      writeMeta(meta);
      window.localStorage.setItem(VAULT_NAME_KEY, name);
      window.localStorage.setItem(VAULT_STORAGE_MODE_KEY, "storj");
      const fingerprintStr = await fingerprint(passphrase, salt);
      try {
        const lid = await lookupId(name, passphrase);
        await putStorjMeta({ data: { lookupId: lid, meta } });
      } catch (e) {
        console.warn("Vault meta sync failed (offline?)", e);
      }
      passphraseRef.current = passphrase;
      setKey(derived);
      setFp(fingerprintStr);
      setVaultName(name);
      setStorageMode("storj");
      setTwoFactorEnabled(false);
      setHasVault(true);
      void appendAuditEvent(derived, fingerprintStr.replace(/-/g, ""), "create");
    },
    [],
  );

  const createDemoVault = useCallback(async (name: string, passphrase: string) => {
    const strength = passphraseStrength(passphrase);
    if (!strength.ok) {
      throw new Error("Passphrase too short. Use at least 3 characters.");
    }
    const salt = randomBytes(16);
    const iterations = PBKDF2_ITERATIONS_DEFAULT;
    const derived = await deriveKey(passphrase, salt, iterations);
    const verifier = await encryptString(derived, VERIFIER_PLAINTEXT);
    const meta: VaultMeta = { salt: b64.encode(salt), verifier, iterations };
    const fingerprintStr = await fingerprint(passphrase, salt);
    writeMeta(meta);
    window.localStorage.setItem(VAULT_NAME_KEY, name);
    window.localStorage.setItem(VAULT_STORAGE_MODE_KEY, "local");
    passphraseRef.current = passphrase;
    setKey(derived);
    setFp(fingerprintStr);
    setVaultName(name);
    setStorageMode("local");
    setTwoFactorEnabled(false);
    setHasVault(true);
  }, []);

  const unlock = useCallback(
    async (
      name: string,
      passphrase: string,
      turnstileToken: string,
      twoFactorCode?: string,
    ): Promise<UnlockResult> => {
      // The cached local meta is NOT authoritative for a Storj vault. Enabling
      // 2FA on one device writes it to Storj, but any other device still holds
      // a pre-2FA copy in localStorage — trusting that copy skipped the 2FA
      // check entirely. Always re-read the remote meta and let it win.
      const localMeta = readMeta();
      let meta = localMeta;
      const isLocalVault = window.localStorage.getItem(VAULT_STORAGE_MODE_KEY) === "local";
      let remoteMissingTwoFactor = false;
      if (!isLocalVault) {
        try {
          const lid = await lookupId(name, passphrase);
          const res = await getStorjMeta({ data: { lookupId: lid, turnstileToken } });
          if (res.meta) meta = res.meta;
        } catch (e) {
          console.warn("Remote meta fetch failed", e);
        }
      }
      // No local copy and nothing at the remote lookup id — there is no vault to
      // open. Distinct from a decryption failure so the UI can say which it is.
      if (!meta) return { ok: false, reason: "not-found" };

      // Fail safe, and a migration path. Vaults enrolled before `twoFactor` was
      // part of the stored schema have it only in localStorage — the server
      // stripped it on write. Never let an absent remote copy switch 2FA off:
      // if either side still claims it is enabled, enforce it.
      //
      // Only when both copies share key material. The local secret is encrypted
      // under the key derived from the local salt, so grafting it onto a meta
      // with a different salt makes it undecryptable — which surfaced as a bogus
      // "wrong passphrase" error rather than anything about 2FA.
      const sameKeyMaterial =
        localMeta?.salt === meta.salt &&
        (localMeta?.iterations ?? PBKDF2_ITERATIONS_LEGACY) ===
          (meta.iterations ?? PBKDF2_ITERATIONS_LEGACY);
      if (!meta.twoFactor?.enabled && localMeta?.twoFactor?.enabled && sameKeyMaterial) {
        meta = { ...meta, twoFactor: localMeta.twoFactor };
        remoteMissingTwoFactor = !isLocalVault;
      }
      const salt = b64.decode(meta.salt);
      const iters = meta.iterations ?? PBKDF2_ITERATIONS_LEGACY;
      const derived = await deriveKey(passphrase, salt, iters);
      try {
        const verified = await decryptString(derived, meta.verifier);
        if (verified !== VERIFIER_PLAINTEXT) return { ok: false, reason: "invalid" };

        if (meta.twoFactor?.enabled) {
          if (!twoFactorCode) return { ok: false, reason: "two-factor-required" };
          const secret = await decryptString(derived, meta.twoFactor.secret);
          if (!(await verifyTotpCode(secret, twoFactorCode))) {
            return { ok: false, reason: "two-factor-invalid" };
          }
        }

        writeMeta(meta);
        window.localStorage.setItem(VAULT_NAME_KEY, name);
        setHasVault(true);
        const fingerprintStr = await fingerprint(passphrase, salt);
        passphraseRef.current = passphrase;
        setKey(derived);
        setFp(fingerprintStr);
        setVaultName(name);
        setTwoFactorEnabled(!!meta.twoFactor?.enabled);
        const savedMode =
          window.localStorage.getItem(VAULT_STORAGE_MODE_KEY) === "local" ? "local" : "storj";
        setStorageMode(savedMode);
        if (savedMode === "storj") {
          void appendAuditEvent(derived, fingerprintStr.replace(/-/g, ""), "unlock");
          // Self-heal: the 2FA settings were recovered from the local copy only,
          // so push them to Storj now that the passphrase has been verified.
          // Without this the vault stays one cache-clear away from losing 2FA.
          if (remoteMissingTwoFactor) {
            void syncMetaToStorj(name, passphrase, meta).catch((e: unknown) =>
              console.warn("Could not restore 2FA settings to storage", e),
            );
          }
        }
        return { ok: true };
      } catch {
        return { ok: false, reason: "invalid" };
      }
    },
    [],
  );

  const enableTwoFactor = useCallback(
    async (secret: string, code: string) => {
      const meta = readMeta();
      if (!meta || !key) throw new Error("Vault not loaded.");
      if (!(await verifyTotpCode(secret, code))) {
        throw new Error("Authenticator code did not match.");
      }

      const next: VaultMeta = {
        ...meta,
        twoFactor: {
          enabled: true,
          secret: await encryptString(key, secret),
          createdAt: Date.now(),
        },
      };

      // Remote first: if the sync fails this throws and nothing is committed,
      // rather than leaving 2FA on locally and off everywhere else.
      if (storageMode === "storj") {
        await syncMetaToStorj(vaultName, passphraseRef.current, next);
      }
      writeMeta(next);
      setTwoFactorEnabled(true);
    },
    [key, storageMode, vaultName],
  );

  const disableTwoFactor = useCallback(
    async (code: string) => {
      const meta = readMeta();
      if (!meta || !key) throw new Error("Vault not loaded.");
      if (!meta.twoFactor?.enabled) return;

      const secret = await decryptString(key, meta.twoFactor.secret);
      if (!(await verifyTotpCode(secret, code))) {
        throw new Error("Authenticator code did not match.");
      }

      const { twoFactor: _twoFactor, ...next } = meta;
      // Remote first, same reasoning as enableTwoFactor.
      if (storageMode === "storj") {
        await syncMetaToStorj(vaultName, passphraseRef.current, next);
      }
      writeMeta(next);
      setTwoFactorEnabled(false);
    },
    [key, storageMode, vaultName],
  );

  const changePassphrase = useCallback(
    async (oldPassphrase: string, newPassphrase: string) => {
      const meta = readMeta();
      if (!meta || !vaultName) throw new Error("Vault not loaded.");
      // Verify old passphrase
      const oldSalt = b64.decode(meta.salt);
      const oldIters = meta.iterations ?? PBKDF2_ITERATIONS_LEGACY;
      const oldKey = await deriveKey(oldPassphrase, oldSalt, oldIters);
      try {
        const verified = await decryptString(oldKey, meta.verifier);
        if (verified !== VERIFIER_PLAINTEXT) throw new Error("bad");
      } catch {
        throw new Error("Current passphrase is incorrect.");
      }
      const strength = passphraseStrength(newPassphrase);
      if (!strength.ok) {
        throw new Error("New passphrase too short. Use at least 3 characters.");
      }

      const oldFp = await fingerprint(oldPassphrase, oldSalt);
      const oldVaultId = oldFp.replace(/-/g, "");

      // Derive new key + new salt at the strong default iteration count.
      const newSalt = randomBytes(16);
      const newIters = PBKDF2_ITERATIONS_DEFAULT;
      const newKey = await deriveKey(newPassphrase, newSalt, newIters);
      const newFp = await fingerprint(newPassphrase, newSalt);
      const newVaultId = newFp.replace(/-/g, "");
      const newVerifier = await encryptString(newKey, VERIFIER_PLAINTEXT);
      const newMeta: VaultMeta = {
        salt: b64.encode(newSalt),
        verifier: newVerifier,
        iterations: newIters,
        twoFactor: await reencryptTwoFactor(meta, oldKey, newKey),
      };

      if (storageMode === "local") {
        const localStorage = createLocalVaultStorage(vaultName);
        const notes = await localStorage.listNotes();
        for (const note of notes) {
          const title = await decryptString(oldKey, note.title);
          const body = await decryptString(oldKey, note.body);
          await localStorage.putNote({
            ...note,
            title: await encryptString(newKey, title),
            body: await encryptString(newKey, body),
          });
        }
        writeMeta(newMeta);
        passphraseRef.current = newPassphrase;
        setKey(newKey);
        setFp(newFp);
        setTwoFactorEnabled(!!newMeta.twoFactor?.enabled);
        return;
      }

      // Re-encrypt every note under the new key & write to new vault path
      const { notes } = await listStorjNotes({ data: { vaultId: oldVaultId } });
      for (const n of notes) {
        const title = await decryptString(oldKey, n.title);
        const body = await decryptString(oldKey, n.body);
        const reTitle = await encryptString(newKey, title);
        const reBody = await encryptString(newKey, body);
        await putStorjNote({
          data: {
            vaultId: newVaultId,
            note: { id: n.id, title: reTitle, body: reBody, updatedAt: n.updatedAt },
          },
        });
      }

      // Re-encrypt audit log under new key
      const audit = await readAuditFromStorj(oldKey, oldVaultId);
      audit.push({
        ts: Date.now(),
        ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "unknown",
        ip: "self",
        event: "passphrase-change",
      });
      try {
        await writeAuditToStorj(newKey, newVaultId, audit);
      } catch (e) {
        console.warn("Audit migration failed", e);
      }

      // Publish new lookup meta (new lookupId derived from name+newPass)
      const newLid = await lookupId(vaultName, newPassphrase);
      await putStorjMeta({ data: { lookupId: newLid, meta: newMeta } });

      // Commit local change
      writeMeta(newMeta);
      passphraseRef.current = newPassphrase;
      setKey(newKey);
      setFp(newFp);
      setTwoFactorEnabled(!!newMeta.twoFactor?.enabled);

      // Best-effort cleanup of old data — never block on these
      try {
        const oldLid = await lookupId(vaultName, oldPassphrase);
        await deleteStorjMeta({ data: { lookupId: oldLid } });
      } catch (e) {
        console.warn("Old lookup cleanup failed", e);
      }
      for (const n of notes) {
        try {
          await deleteStorjNote({ data: { vaultId: oldVaultId, noteId: n.id } });
        } catch {
          // ignore
        }
      }
    },
    [vaultName, storageMode],
  );

  const loadAudit = useCallback(async (): Promise<AuditEntry[]> => {
    if (!key || !fp) return [];
    if (storageMode === "local") return [];
    return readAuditFromStorj(key, fp.replace(/-/g, ""));
  }, [key, fp, storageMode]);

  const lock = useCallback(() => {
    passphraseRef.current = null;
    setKey(null);
    setFp(null);
  }, []);

  // ── Idle auto-logout ───────────────────────────────────────────────
  // Wipes the in-memory key after the configured period of inactivity.
  // The setting is stored locally because the decrypted key never leaves memory.
  useEffect(() => {
    if (key === null) return;
    if (sessionTimeoutMinutes === "never") return;
    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => lock(), timeoutMs);
    };
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [key, lock, sessionTimeoutMinutes]);

  const destroyVault = useCallback(async () => {
    // Best-effort remote wipe — never block local destruction on network.
    const passphrase = passphraseRef.current;
    const name = vaultName;
    const fpStr = fp;
    try {
      if (storageMode === "local") throw new Error("local-demo");
      if (fpStr) {
        const vaultId = fpStr.replace(/-/g, "");
        try {
          await purgeStorjVault({ data: { vaultId } });
        } catch {
          /* ignore */
        }
        try {
          await deleteStorjAudit({ data: { vaultId } });
        } catch {
          /* ignore */
        }
      }
      if (name && passphrase) {
        try {
          const lid = await lookupId(name, passphrase);
          await deleteStorjMeta({ data: { lookupId: lid } });
        } catch {
          /* ignore */
        }
      }
      if (name) {
        try {
          const nid = await nameId(name);
          await deleteStorjName({ data: { nameId: nid } });
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      if ((e as Error).message !== "local-demo") {
        console.warn("Remote vault destroy partially failed", e);
      }
    }

    window.localStorage.removeItem(VAULT_META_KEY);
    window.localStorage.removeItem(VAULT_NAME_KEY);
    window.localStorage.removeItem(VAULT_STORAGE_MODE_KEY);
    window.localStorage.removeItem("krypta:files");
    window.localStorage.removeItem("krypta:notes");
    if (name) {
      window.localStorage.removeItem(`krypta:local:files:${name}`);
      window.localStorage.removeItem(`krypta:local:notes:${name}`);
    }
    // Clear offline note cache mirror
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("krypta:cache:")) window.localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
    passphraseRef.current = null;
    setKey(null);
    setFp(null);
    setVaultName(null);
    setStorageMode("storj");
    setTwoFactorEnabled(false);
    setHasVault(false);
  }, [vaultName, fp, storageMode]);

  return (
    <VaultContext.Provider
      value={{
        isLocked: key === null,
        hasVault,
        fingerprint: fp,
        vaultName,
        storageMode,
        sessionTimeoutMinutes,
        twoFactorEnabled,
        key,
        createVault,
        createDemoVault,
        unlock,
        enableTwoFactor,
        disableTwoFactor,
        changePassphrase,
        loadAudit,
        setSessionTimeoutMinutes,
        lock,
        destroyVault,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}
