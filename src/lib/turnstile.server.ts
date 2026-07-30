import { createServerFn } from "@tanstack/react-start";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(token: string, remoteip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY not configured — rejecting request");
    return false;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set("remoteip", remoteip);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body });
    const result = (await res.json()) as { success?: boolean };
    return result.success === true;
  } catch (err) {
    console.error("Turnstile verification request failed", err);
    return false;
  }
}

export const getTurnstileSiteKey = createServerFn({ method: "GET" }).handler(async () => {
  return { siteKey: process.env.TURNSTILE_SITE_KEY ?? null };
});
