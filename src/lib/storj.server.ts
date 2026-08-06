// Server-only Storj S3 client. Never imported by client bundles.
import { S3Client } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

export function getStorjClient(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.STORJ_ENDPOINT;
  const accessKeyId = process.env.STORJ_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORJ_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Storj credentials are not configured");
  }
  _client = new S3Client({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return _client;
}

export function getBucket(): string {
  const bucket = process.env.STORJ_BUCKET;
  if (!bucket) throw new Error("STORJ_BUCKET is not configured");
  return bucket;
}

// Vault id must be hex with optional hyphens (from passphrase fingerprint).
export function safeVaultId(id: string): string {
  if (!/^[a-fA-F0-9-]{8,128}$/.test(id)) {
    throw new Error("Invalid vault id");
  }
  return id.toLowerCase().replace(/-/g, "");
}

export function safeNoteId(id: string): string {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    throw new Error("Invalid note id");
  }
  return id;
}
