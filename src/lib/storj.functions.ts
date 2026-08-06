import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getStorjClient, getBucket, safeVaultId, safeNoteId } from "./storj.server";
import { verifyTurnstileToken } from "./turnstile.server";

const blobSchema = z.object({
  iv: z.string().min(1).max(64),
  data: z.string().min(1).max(2_000_000),
});

const noteSchema = z.object({
  id: z.string().min(1).max(64),
  title: blobSchema,
  body: blobSchema,
  updatedAt: z.number().int().nonnegative(),
});

const contactMessageSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  topic: z.string().trim().min(1).max(80),
  message: z.string().trim().min(3).max(2_000),
  turnstileToken: z.string().min(1),
});

function contactKey() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = crypto.randomUUID();
  return `contact/${yyyy}/${mm}/${now.toISOString()}-${id}.json`;
}

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      name: string;
      email: string;
      topic: string;
      message: string;
      turnstileToken: string;
    }) => contactMessageSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const verified = await verifyTurnstileToken(
      data.turnstileToken,
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    );
    if (!verified) {
      throw new Error("Bot verification failed. Please try again.");
    }
    const client = getStorjClient();
    const bucket = getBucket();
    const { turnstileToken: _turnstileToken, ...record } = data;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: contactKey(),
        Body: JSON.stringify({
          ...record,
          submittedAt: Date.now(),
          userAgent: req.headers.get("user-agent")?.slice(0, 240) ?? "unknown",
          country: req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "",
        }),
        ContentType: "application/json",
      }),
    );
    return { ok: true as const };
  });

export const listStorjNotes = createServerFn({ method: "POST" })
  .inputValidator((input: { vaultId: string }) =>
    z.object({ vaultId: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const vaultId = safeVaultId(data.vaultId);
    const client = getStorjClient();
    const bucket = getBucket();
    const prefix = `vaults/${vaultId}/notes/`;

    const list = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }),
    );
    const keys = (list.Contents ?? []).map((o) => o.Key!).filter(Boolean);

    const notes = await Promise.all(
      keys.map(async (Key) => {
        try {
          const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key }));
          const body = await obj.Body!.transformToString();
          const parsed = noteSchema.safeParse(JSON.parse(body));
          return parsed.success ? parsed.data : null;
        } catch {
          return null;
        }
      }),
    );
    return { notes: notes.filter((n): n is z.infer<typeof noteSchema> => n !== null) };
  });

export const putStorjNote = createServerFn({ method: "POST" })
  .inputValidator((input: { vaultId: string; note: unknown }) =>
    z.object({ vaultId: z.string().min(8).max(128), note: noteSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const vaultId = safeVaultId(data.vaultId);
    const noteId = safeNoteId(data.note.id);
    const client = getStorjClient();
    const bucket = getBucket();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `vaults/${vaultId}/notes/${noteId}.json`,
        Body: JSON.stringify(data.note),
        ContentType: "application/json",
      }),
    );
    return { ok: true };
  });

export const deleteStorjNote = createServerFn({ method: "POST" })
  .inputValidator((input: { vaultId: string; noteId: string }) =>
    z
      .object({
        vaultId: z.string().min(8).max(128),
        noteId: z.string().min(1).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const vaultId = safeVaultId(data.vaultId);
    const noteId = safeNoteId(data.noteId);
    const client = getStorjClient();
    const bucket = getBucket();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: `vaults/${vaultId}/notes/${noteId}.json`,
      }),
    );
    return { ok: true };
  });

// Must mirror VaultMeta in vault-context. Zod strips unknown keys, so any field
// missing here is silently dropped on write — which is exactly how 2FA settings
// were being lost before ever reaching storage. The secret stays an encrypted
// blob; the server never sees the TOTP seed in the clear.
const twoFactorSchema = z.object({
  enabled: z.boolean(),
  secret: blobSchema,
  createdAt: z.number().int().nonnegative(),
});

const metaSchema = z.object({
  salt: z.string().min(1).max(256),
  verifier: blobSchema,
  iterations: z.number().int().min(1).max(10_000_000).optional(),
  twoFactor: twoFactorSchema.optional(),
});

const lookupSchema = z.object({
  lookupId: z.string().regex(/^[a-f0-9]{64}$/),
});

const getMetaSchema = lookupSchema.extend({ turnstileToken: z.string().min(1) });

export const getStorjMeta = createServerFn({ method: "POST" })
  .inputValidator((input: { lookupId: string; turnstileToken: string }) =>
    getMetaSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const verified = await verifyTurnstileToken(
      data.turnstileToken,
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    );
    if (!verified) {
      return { meta: null };
    }
    const client = getStorjClient();
    const bucket = getBucket();
    try {
      const obj = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: `lookup/${data.lookupId}/meta.json` }),
      );
      const body = await obj.Body!.transformToString();
      const parsed = metaSchema.safeParse(JSON.parse(body));
      return { meta: parsed.success ? parsed.data : null };
    } catch {
      return { meta: null };
    }
  });

export const putStorjMeta = createServerFn({ method: "POST" })
  .inputValidator((input: { lookupId: string; meta: unknown }) =>
    z.object({ lookupId: lookupSchema.shape.lookupId, meta: metaSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const client = getStorjClient();
    const bucket = getBucket();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `lookup/${data.lookupId}/meta.json`,
        Body: JSON.stringify(data.meta),
        ContentType: "application/json",
      }),
    );
    return { ok: true };
  });

const nameIdSchema = z.object({ nameId: z.string().regex(/^[a-f0-9]{64}$/) });

export const checkStorjName = createServerFn({ method: "POST" })
  .inputValidator((input: { nameId: string }) => nameIdSchema.parse(input))
  .handler(async ({ data }) => {
    const client = getStorjClient();
    const bucket = getBucket();
    try {
      await client.send(new GetObjectCommand({ Bucket: bucket, Key: `names/${data.nameId}.json` }));
      return { taken: true };
    } catch {
      return { taken: false };
    }
  });

const claimNameSchema = nameIdSchema.extend({ turnstileToken: z.string().min(1) });

export const claimStorjName = createServerFn({ method: "POST" })
  .inputValidator((input: { nameId: string; turnstileToken: string }) =>
    claimNameSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const verified = await verifyTurnstileToken(
      data.turnstileToken,
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    );
    if (!verified) {
      return { ok: false, reason: "error" as const };
    }
    const client = getStorjClient();
    const bucket = getBucket();
    const Key = `names/${data.nameId}.json`;
    // Re-check then write. Storj S3 has no native atomic if-none-match, so
    // this is best-effort; collisions are still extremely unlikely.
    try {
      await client.send(new GetObjectCommand({ Bucket: bucket, Key }));
      return { ok: false, reason: "taken" as const };
    } catch (err) {
      // Only "not found" means the name is free. Network/permission errors
      // must NOT be treated as "available" — that would let two different
      // passphrases claim the same Vault ID.
      const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
      const code = e?.name || e?.Code;
      const status = e?.$metadata?.httpStatusCode;
      const notFound = code === "NoSuchKey" || code === "NotFound" || status === 404;
      if (!notFound) {
        return { ok: false, reason: "error" as const };
      }
    }
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key,
        Body: JSON.stringify({ claimedAt: Date.now() }),
        ContentType: "application/json",
      }),
    );
    return { ok: true as const };
  });

export const deleteStorjMeta = createServerFn({ method: "POST" })
  .inputValidator((input: { lookupId: string }) => lookupSchema.parse(input))
  .handler(async ({ data }) => {
    const client = getStorjClient();
    const bucket = getBucket();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: `lookup/${data.lookupId}/meta.json` }),
      );
    } catch {
      // ignore
    }
    return { ok: true };
  });

export const deleteStorjName = createServerFn({ method: "POST" })
  .inputValidator((input: { nameId: string }) => nameIdSchema.parse(input))
  .handler(async ({ data }) => {
    const client = getStorjClient();
    const bucket = getBucket();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: `names/${data.nameId}.json` }),
      );
    } catch {
      // ignore
    }
    return { ok: true };
  });

export const deleteStorjAudit = createServerFn({ method: "POST" })
  .inputValidator((input: { vaultId: string }) =>
    z.object({ vaultId: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const vaultId = safeVaultId(data.vaultId);
    const client = getStorjClient();
    const bucket = getBucket();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: `vaults/${vaultId}/audit.json` }),
      );
    } catch {
      // ignore
    }
    return { ok: true };
  });

export const purgeStorjVault = createServerFn({ method: "POST" })
  .inputValidator((input: { vaultId: string }) =>
    z.object({ vaultId: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const vaultId = safeVaultId(data.vaultId);
    const client = getStorjClient();
    const bucket = getBucket();
    const prefix = `vaults/${vaultId}/`;
    let deleted = 0;
    let token: string | undefined = undefined;
    do {
      const list: import("@aws-sdk/client-s3").ListObjectsV2CommandOutput = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      );
      const keys = (list.Contents ?? []).map((o) => o.Key!).filter(Boolean);
      for (const Key of keys) {
        try {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
          deleted++;
        } catch {
          // ignore individual failures
        }
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
    return { ok: true, deleted };
  });

// Encrypted audit log (last N unlock events) for a vault.
export const getStorjAudit = createServerFn({ method: "POST" })
  .inputValidator((input: { vaultId: string }) =>
    z.object({ vaultId: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const vaultId = safeVaultId(data.vaultId);
    const client = getStorjClient();
    const bucket = getBucket();
    try {
      const obj = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: `vaults/${vaultId}/audit.json` }),
      );
      const body = await obj.Body!.transformToString();
      const parsed = blobSchema.safeParse(JSON.parse(body));
      return { blob: parsed.success ? parsed.data : null };
    } catch {
      return { blob: null };
    }
  });

export const putStorjAudit = createServerFn({ method: "POST" })
  .inputValidator((input: { vaultId: string; blob: unknown }) =>
    z.object({ vaultId: z.string().min(8).max(128), blob: blobSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const vaultId = safeVaultId(data.vaultId);
    const client = getStorjClient();
    const bucket = getBucket();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `vaults/${vaultId}/audit.json`,
        Body: JSON.stringify(data.blob),
        ContentType: "application/json",
      }),
    );
    return { ok: true };
  });

// Returns the caller's IP and country (best-effort) so the client can record
// audit entries with a coarse location signal. Never stored server-side.
export const getClientInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const h = req.headers;
  const ip =
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const country = h.get("cf-ipcountry") || "";
  return { ip, country };
});

// ---- Share revocation registry ------------------------------------------------
// Each generated share link gets a public shareId (32-hex). The owner keeps a
// secret (revokeSecret) and only its sha256 hash is uploaded. To revoke, the
// owner presents the secret; server hashes and compares. Viewers do a cheap
// status lookup before decrypting.

const shareIdSchema = z.string().regex(/^[a-f0-9]{32}$/);
const hexHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

const shareRecordSchema = z.object({
  revokeHash: hexHashSchema,
  createdAt: z.number().int().nonnegative(),
  revoked: z.boolean(),
  revokedAt: z.number().int().nonnegative().optional(),
});

function shareKey(id: string) {
  return `shares/${id}.json`;
}

export const registerShare = createServerFn({ method: "POST" })
  .inputValidator((input: { shareId: string; revokeHash: string }) =>
    z.object({ shareId: shareIdSchema, revokeHash: hexHashSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const client = getStorjClient();
    const bucket = getBucket();
    // Best-effort idempotency: if it already exists, refuse to overwrite.
    try {
      await client.send(new GetObjectCommand({ Bucket: bucket, Key: shareKey(data.shareId) }));
      return { ok: false as const, reason: "exists" as const };
    } catch {
      // not found → safe to create
    }
    const record = { revokeHash: data.revokeHash, createdAt: Date.now(), revoked: false };
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: shareKey(data.shareId),
        Body: JSON.stringify(record),
        ContentType: "application/json",
      }),
    );
    return { ok: true as const };
  });

export const getShareStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { shareId: string }) => z.object({ shareId: shareIdSchema }).parse(input))
  .handler(async ({ data }) => {
    const client = getStorjClient();
    const bucket = getBucket();
    try {
      const obj = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: shareKey(data.shareId) }),
      );
      const body = await obj.Body!.transformToString();
      const parsed = shareRecordSchema.safeParse(JSON.parse(body));
      if (!parsed.success) return { exists: false, revoked: false };
      return { exists: true, revoked: parsed.data.revoked };
    } catch {
      // Unknown shareId (legacy links or unregistered) → treat as active.
      return { exists: false, revoked: false };
    }
  });

export const revokeShare = createServerFn({ method: "POST" })
  .inputValidator((input: { shareId: string; revokeSecret: string }) =>
    z
      .object({ shareId: shareIdSchema, revokeSecret: z.string().regex(/^[a-f0-9]{32}$/) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const client = getStorjClient();
    const bucket = getBucket();
    let record: z.infer<typeof shareRecordSchema>;
    try {
      const obj = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: shareKey(data.shareId) }),
      );
      const body = await obj.Body!.transformToString();
      const parsed = shareRecordSchema.safeParse(JSON.parse(body));
      if (!parsed.success) return { ok: false as const, reason: "not_found" as const };
      record = parsed.data;
    } catch {
      return { ok: false as const, reason: "not_found" as const };
    }

    // Verify the secret matches the stored hash (constant-time-ish compare).
    const { createHash, timingSafeEqual } = await import("crypto");
    const computed = createHash("sha256").update(data.revokeSecret).digest("hex");
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(record.revokeHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false as const, reason: "unauthorized" as const };
    }

    if (record.revoked) return { ok: true as const, alreadyRevoked: true };

    record.revoked = true;
    record.revokedAt = Date.now();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: shareKey(data.shareId),
        Body: JSON.stringify(record),
        ContentType: "application/json",
      }),
    );
    return { ok: true as const, alreadyRevoked: false };
  });
