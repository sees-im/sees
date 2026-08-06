import { createFileRoute } from "@tanstack/react-router";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getStorjClient, getBucket } from "@/lib/storj.server";

export const Route = createFileRoute("/api/webhooks/nearpayments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NEARPAYMENTS_IPN_SECRET;
        if (!secret) {
          console.error("NEARPAYMENTS_IPN_SECRET is not configured");
          return new Response("Webhook not configured", { status: 500 });
        }

        const signature = request.headers.get("x-nowpayments-sig");
        if (!signature) {
          return new Response("Missing signature", { status: 401 });
        }

        const rawBody = await request.text();
        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const sortedBody = JSON.stringify(sortDeep(payload));
        const expected = await hmacSha512Hex(secret, sortedBody);
        if (!timingSafeEqualHex(expected, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = payload as Record<string, unknown>;
        try {
          await persistEvent(event);
        } catch (e) {
          // Persisting is best-effort — a storage hiccup shouldn't cause
          // NearPayments to keep retrying a webhook we already verified.
          console.error("Failed to persist contribution event", e);
        }

        return Response.json({ ok: true });
      },
    },
  },
});

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message) as BufferSource);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function persistEvent(event: Record<string, unknown>) {
  const client = getStorjClient();
  const bucket = getBucket();
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const orderId = typeof event.order_id === "string" ? event.order_id : crypto.randomUUID();
  const key = `contributions/${yyyy}/${mm}/${now.toISOString()}-${orderId}.json`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(event),
      ContentType: "application/json",
    }),
  );
}
