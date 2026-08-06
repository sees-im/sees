import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { isAdminAuthed, loginAdmin, logoutAdmin } from "./admin.server";
import { getBucket, getStorjClient } from "./storj.server";

const loginSchema = z.object({
  password: z.string().min(1).max(200),
  turnstileToken: z.string().min(1),
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; turnstileToken: string }) => loginSchema.parse(input))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    return loginAdmin(data.password, data.turnstileToken, ip);
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  await logoutAdmin();
  return { ok: true };
});

export const checkAdminAuth = createServerFn({ method: "GET" }).handler(async () => ({
  authed: await isAdminAuthed(),
}));

// Every claimed Vault ID gets one object under names/ — the closest thing
// this zero-knowledge app has to a "user count." Counts existence only;
// nothing about vault content is ever read.
export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isAdminAuthed())) throw new Error("Unauthorized");
  const client = getStorjClient();
  const bucket = getBucket();
  let vaultCount = 0;
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "names/",
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    vaultCount += res.KeyCount ?? res.Contents?.length ?? 0;
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return { vaultCount };
});
