// Zero-knowledge client-side crypto using Web Crypto API.
// Passphrase -> PBKDF2-SHA256 (250k iterations) -> AES-GCM key.
// Nothing leaves the browser unencrypted.

const enc = new TextEncoder();
const dec = new TextDecoder();

// Keep the iteration count stable so existing vaults and newly created vaults
// behave consistently across domains and deployments.
export const PBKDF2_ITERATIONS_DEFAULT = 250_000;
export const PBKDF2_ITERATIONS_LEGACY = 250_000;
// lookupId is a public opaque pointer (no secret leaks even if revealed),
// so we keep it cheap and stable to avoid breaking cross-device discovery.
const LOOKUP_ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS_DEFAULT,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function fingerprint(passphrase: string, salt: Uint8Array): Promise<string> {
  const data = new Uint8Array(salt.length + passphrase.length);
  data.set(salt);
  data.set(enc.encode(passphrase), salt.length);
  const hash = await crypto.subtle.digest("SHA-256", data as BufferSource);
  const bytes = new Uint8Array(hash).slice(0, 8);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

export interface EncryptedBlob {
  iv: string; // base64
  data: string; // base64 ciphertext
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = randomBytes(IV_BYTES);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(plaintext) as BufferSource,
  );
  return { iv: bufToB64(iv), data: bufToB64(cipher) };
}

export async function decryptString(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBuf(blob.iv) as BufferSource },
    key,
    b64ToBuf(blob.data) as BufferSource,
  );
  return dec.decode(plain);
}

export async function encryptBytes(key: CryptoKey, bytes: Uint8Array): Promise<EncryptedBlob> {
  const iv = randomBytes(IV_BYTES);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    bytes as BufferSource,
  );
  return { iv: bufToB64(iv), data: bufToB64(cipher) };
}

export async function decryptBytes(key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBuf(blob.iv) as BufferSource },
    key,
    b64ToBuf(blob.data) as BufferSource,
  );
  return new Uint8Array(plain);
}

export const b64 = { encode: bufToB64, decode: b64ToBuf };

export const VAULT_META_KEY = "krypta:vault";

export interface VaultMeta {
  salt: string; // base64
  verifier: EncryptedBlob; // encrypts a known token to verify passphrase
  iterations?: number; // PBKDF2 iterations; absent = legacy 250k
  twoFactor?: {
    enabled: boolean;
    secret: EncryptedBlob; // encrypted TOTP secret
    createdAt: number;
  };
}

export const VERIFIER_PLAINTEXT = "krypta:v1:ok";

// Public lookup id derived from passphrase alone via PBKDF2 + fixed pepper.
// Lets any device locate the encrypted vault meta on Storj from the passphrase.
// Server only sees this opaque hex id — never the passphrase.
const LOOKUP_PEPPER = enc.encode("krypta:lookup:v1:do-not-change");

export function normalizeVaultName(name: string): string {
  return name.trim().toLowerCase();
}

// Public, deterministic id for a vault name (no passphrase). Used to claim
// the name on Storj so we can refuse duplicate registrations.
const NAME_PEPPER = enc.encode("krypta:name:v1");
export async function nameId(vaultName: string): Promise<string> {
  const name = normalizeVaultName(vaultName);
  if (!name) throw new Error("Vault ID required");
  const buf = new Uint8Array(NAME_PEPPER.length + 1 + name.length);
  buf.set(NAME_PEPPER, 0);
  buf[NAME_PEPPER.length] = 0x1f;
  buf.set(enc.encode(name), NAME_PEPPER.length + 1);
  const hash = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function lookupId(vaultName: string, passphrase: string): Promise<string> {
  const name = normalizeVaultName(vaultName);
  if (!name) throw new Error("Vault ID required");
  // Namespace the salt with the vault name so two users picking the same
  // passphrase land on different lookup ids and never collide on Storj.
  const salt = new Uint8Array(LOOKUP_PEPPER.length + name.length + 1);
  salt.set(LOOKUP_PEPPER, 0);
  salt[LOOKUP_PEPPER.length] = 0x1f;
  salt.set(enc.encode(name), LOOKUP_PEPPER.length + 1);
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: LOOKUP_ITERATIONS, hash: "SHA-256" },
    baseKey,
    256,
  );
  const bytes = new Uint8Array(bits);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function passphraseStrength(p: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  ok: boolean;
} {
  if (p.length === 0) return { score: 0, label: "Empty", ok: false };
  let score = 0;
  if (p.length >= 3) score++;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (classes >= 3) score++;
  const labels = ["Empty", "Weak", "Fair", "Good", "Strong"];
  const final = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const ok = p.length >= 3;
  return { score: final, label: labels[final], ok };
}
