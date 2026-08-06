// Server-only admin auth. Never imported by client bundles.
import { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { useSession } from "@tanstack/react-start/server";
import { getBucket, getStorjClient } from "./storj.server";
import { verifyTurnstileToken } from "./turnstile.server";

interface AdminSessionData {
  authed?: boolean;
}

function sessionConfig() {
  const password = process.env.ADMIN_SESSION_SECRET;
  if (!password) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return { password, name: "sees_admin_session", maxAge: 60 * 60 * 12 };
}

export async function isAdminAuthed(): Promise<boolean> {
  const session = await useSession<AdminSessionData>(sessionConfig());
  return session.data?.authed === true;
}

// Persistent per-IP lockout backed by Storj, so it survives across
// serverless cold starts and different function instances — an in-memory
// counter would reset on every invocation and offer no real protection.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

function attemptKey(ip: string): string {
  const hash = createHash("sha256").update(ip).digest("hex");
  return `admin-lockout/${hash}.json`;
}

async function getAttempts(ip: string): Promise<AttemptRecord> {
  const client = getStorjClient();
  const bucket = getBucket();
  try {
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: attemptKey(ip) }));
    const body = await obj.Body?.transformToString();
    if (!body) return { count: 0, lockedUntil: 0 };
    const parsed = JSON.parse(body) as AttemptRecord;
    return { count: parsed.count ?? 0, lockedUntil: parsed.lockedUntil ?? 0 };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

async function setAttempts(ip: string, record: AttemptRecord): Promise<void> {
  const client = getStorjClient();
  const bucket = getBucket();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: attemptKey(ip),
      Body: JSON.stringify(record),
      ContentType: "application/json",
    }),
  );
}

export async function loginAdmin(
  password: string,
  turnstileToken: string,
  ip: string,
): Promise<{ ok: boolean; reason?: "bot" | "locked" | "invalid" }> {
  const verified = await verifyTurnstileToken(turnstileToken, ip);
  if (!verified) return { ok: false, reason: "bot" };

  const attempts = await getAttempts(ip);
  if (attempts.lockedUntil > Date.now()) {
    return { ok: false, reason: "locked" };
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) {
    const count = attempts.count + 1;
    const lockedUntil = count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
    await setAttempts(ip, { count, lockedUntil });
    return { ok: false, reason: "invalid" };
  }

  await setAttempts(ip, { count: 0, lockedUntil: 0 });
  const session = await useSession<AdminSessionData>(sessionConfig());
  await session.update({ authed: true });
  return { ok: true };
}

export async function logoutAdmin(): Promise<void> {
  const session = await useSession<AdminSessionData>(sessionConfig());
  await session.clear();
}
