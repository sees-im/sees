const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ISSUER = "SEES";
const STEP_SECONDS = 30;
const DIGITS = 6;

function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32ToBytes(secret: string): Uint8Array {
  const normalized = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid 2FA setup key.");

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

function counterToBytes(counter: number): Uint8Array {
  let value = BigInt(counter);
  const bytes = new Uint8Array(8);

  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }

  return bytes;
}

async function generateCode(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    base32ToBytes(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, counterToBytes(counter) as BufferSource);
  const hash = new Uint8Array(signature);
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return bytesToBase32(bytes);
}

export function formatTotpSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function createTotpUri(secret: string, vaultName: string): string {
  const label = `${ISSUER}:${vaultName || "vault"}`;
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== DIGITS) return false;

  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  const checks = [counter - 1, counter, counter + 1];

  for (const candidate of checks) {
    if (await generateCode(secret, candidate) === normalized) return true;
  }

  return false;
}
