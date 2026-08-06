// Emits a SHA-256 manifest of every client asset the browser executes, so a
// visitor can hash the running bundle themselves and compare.
//
// Run AFTER `vite build` — it reads the emitted client output.
//
// Two copies are written:
//   .vercel/output/static/build-manifest.json  → served, so /verify can fetch it
//   public/build-manifest.json                 → committed, so the hashes also
//                                                live in the public git repo,
//                                                which is a separate trust
//                                                domain from the deploy.
//
// This gives bundle transparency, NOT byte-reproducible builds: Vite output is
// not guaranteed identical across machines. See /verify for the honest limits.

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const STATIC_DIR = ".vercel/output/static";
const ASSET_DIR = join(STATIC_DIR, "assets");
const OUTPUTS = [join(STATIC_DIR, "build-manifest.json"), "public/build-manifest.json"];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

let names;
try {
  names = readdirSync(ASSET_DIR).sort();
} catch {
  console.error(`build-manifest: ${ASSET_DIR} not found — run \`vite build\` first.`);
  process.exit(1);
}

const files = {};
for (const name of names) {
  const bytes = readFileSync(join(ASSET_DIR, name));
  files[`assets/${name}`] = { sha256: sha256(bytes), bytes: bytes.length };
}

// Deliberately no commit SHA: committing this file rewrites the very commit it
// would name, so the reference would always dangle. What matters for verifying
// is that these hashes match both the served assets and the copy on GitHub.
const manifest = {
  algorithm: "SHA-256",
  builtAt: new Date().toISOString(),
  fileCount: names.length,
  totalBytes: Object.values(files).reduce((sum, f) => sum + f.bytes, 0),
  files,
};

const json = `${JSON.stringify(manifest, null, 2)}\n`;
for (const out of OUTPUTS) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
}

console.log(`build-manifest: hashed ${names.length} client assets`);
console.log(`  total: ${manifest.totalBytes.toLocaleString("en-US")} bytes`);
for (const out of OUTPUTS) console.log(`  wrote ${out}`);
