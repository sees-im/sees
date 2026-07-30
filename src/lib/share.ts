// Shareable note links — fully client-side. The encrypted payload lives in
// the URL fragment so it never reaches any server. Two modes:
//   - "open"  : random AES-GCM key embedded in the fragment (no password)
//   - "locked": AES-GCM key derived from a password via PBKDF2 (key stays
//               with the recipient; only the salt travels in the link)
//
// The fragment is a SINGLE base64url blob with this binary layout:
//   [0]    version (=1)
//   [1]    flags: bit0 = mode (0=open,1=password), bit1 = compressed (gzip)
//   [2..13]  iv (12 bytes)
//   [14..]   open: 32-byte raw key,  password: 16-byte salt
//   [...]    ciphertext (rest)
//
// The plaintext is a compact tuple JSON: [title, body, tags, exp, createdAt]

const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 250_000;

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function deriveShareKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return bytes;
  const cs = new CompressionStream("gzip");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(cs);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("Gzip unsupported");
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export interface SharePayload {
  title: string;
  body: string;
  tags: string[];
  exp: number | null;
  createdAt: number;
}

export interface BuildShareOptions {
  password?: string;
  expiresInMs: number | null;
}

export interface BuildShareResult {
  url: string;
  shareId: string;       // 32-hex public id (sent to server for revoke lookups)
  revokeSecret: string;  // 32-hex secret kept by owner; proves authority to revoke
  revokeHash: string;    // sha256(revokeSecret) as 64-hex; uploaded to server
}

const VERSION = 1;
const FLAG_PASSWORD = 0b01;
const FLAG_COMPRESSED = 0b10;

function toHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return toHex(new Uint8Array(buf));
}

export async function buildShareUrl(
  base: string,
  data: { title: string; body: string; tags: string[] },
  opts: BuildShareOptions,
): Promise<BuildShareResult> {
  const exp = opts.expiresInMs ? Date.now() + opts.expiresInMs : null;
  const tuple: [string, string, string[], number | null, number] = [
    data.title,
    data.body,
    data.tags,
    exp,
    Date.now(),
  ];
  const json = enc.encode(JSON.stringify(tuple));
  let plaintext: Uint8Array = json;
  let compressed = false;
  try {
    const gz = await gzip(json);
    if (gz.length + 1 < json.length) {
      plaintext = gz;
      compressed = true;
    }
  } catch {
    // ignore
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  let key: CryptoKey;
  let keyMaterial: Uint8Array;
  let flags = 0;
  if (compressed) flags |= FLAG_COMPRESSED;

  if (opts.password && opts.password.length > 0) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    key = await deriveShareKey(opts.password, salt);
    keyMaterial = salt;
    flags |= FLAG_PASSWORD;
  } else {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    key = await crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
    keyMaterial = raw;
  }

  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      plaintext as BufferSource,
    ),
  );

  const blob = concat(new Uint8Array([VERSION, flags]), iv, keyMaterial, cipher);

  // Revocation identifiers. shareId is public (sent to server). revokeSecret
  // never leaves the owner's device until they choose to revoke.
  const shareId = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const revokeSecret = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const revokeHash = await sha256Hex(revokeSecret);

  const url = new URL(base);
  url.pathname = "/s";
  // Fragment format: "<shareId>.<encryptedBlob>". The dot is unused by the
  // base64url alphabet, so parsing is unambiguous.
  url.hash = `${shareId}.${b64urlEncode(blob)}`;
  return { url: url.toString(), shareId, revokeSecret, revokeHash };
}

export type ShareMode = "open" | "password";

export interface ParsedShareLink {
  mode: ShareMode;
  iv: Uint8Array;
  data: Uint8Array;
  rawKey?: Uint8Array;
  salt?: Uint8Array;
  compressed: boolean;
  shareId: string | null;
}

export function parseShareFragment(fragment: string): ParsedShareLink {
  const f = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!f) throw new Error("Invalid share link");

  // New format includes a shareId prefix separated by a dot.
  let shareId: string | null = null;
  let payload = f;
  const dot = f.indexOf(".");
  if (dot > 0 && /^[a-f0-9]{32}$/.test(f.slice(0, dot))) {
    shareId = f.slice(0, dot);
    payload = f.slice(dot + 1);
  }

  const blob = b64urlDecode(payload);
  if (blob.length < 14) throw new Error("Invalid share link");
  const version = blob[0];
  if (version !== VERSION) throw new Error("Unsupported share link version");
  const flags = blob[1];
  const iv = blob.slice(2, 14);
  const isPassword = (flags & FLAG_PASSWORD) !== 0;
  const compressed = (flags & FLAG_COMPRESSED) !== 0;
  if (isPassword) {
    const salt = blob.slice(14, 30);
    return { mode: "password", iv, data: blob.slice(30), salt, compressed, shareId };
  }
  const rawKey = blob.slice(14, 46);
  return { mode: "open", iv, data: blob.slice(46), rawKey, compressed, shareId };
}

export async function decryptShare(
  parsed: ParsedShareLink,
  password?: string,
): Promise<SharePayload> {
  let key: CryptoKey;
  if (parsed.mode === "open") {
    key = await crypto.subtle.importKey(
      "raw",
      parsed.rawKey! as BufferSource,
      "AES-GCM",
      false,
      ["decrypt"],
    );
  } else {
    if (!password) throw new Error("Password required");
    key = await deriveShareKey(password, parsed.salt!);
  }
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: parsed.iv as BufferSource },
      key,
      parsed.data as BufferSource,
    ),
  );
  const json = parsed.compressed ? await gunzip(plain) : plain;
  const tuple = JSON.parse(dec.decode(json));
  if (Array.isArray(tuple) && tuple.length >= 5) {
    const [title, body, tags, exp, createdAt] = tuple;
    return { title, body, tags, exp, createdAt };
  }
  // back-compat with object form
  return tuple as SharePayload;
}

export const EXPIRY_OPTIONS: { label: string; ms: number | null }[] = [
  { label: "5 minutes", ms: 5 * 60_000 },
  { label: "1 hour", ms: 60 * 60_000 },
  { label: "24 hours", ms: 24 * 60 * 60_000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60_000 },
  { label: "30 days", ms: 30 * 24 * 60 * 60_000 },
  { label: "Never", ms: null },
];

export function formatRemaining(exp: number | null): string {
  if (exp === null) return "No expiry";
  const diff = exp - Date.now();
  if (diff <= 0) return "Expired";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h left`;
  const d = Math.floor(h / 24);
  return `${d}d left`;
}
