import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Github } from "lucide-react";

import { MarketingPage, Section, StatCard } from "@/components/MarketingPage";

const MANIFEST_URL = "/build-manifest.json";
const REPO_MANIFEST_URL = "https://github.com/sees-im/sees/blob/main/public/build-manifest.json";

interface ManifestEntry {
  sha256: string;
  bytes: number;
}

interface Manifest {
  algorithm: string;
  builtAt: string;
  fileCount: number;
  totalBytes: number;
  files: Record<string, ManifestEntry>;
}

type RowState = "pending" | "match" | "mismatch" | "error";

interface Row {
  path: string;
  expected: string;
  actual: string | null;
  state: RowState;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function VerifyBuild() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"idle" | "loading" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch(MANIFEST_URL, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Manifest returned ${r.status}`);
        return r.json() as Promise<Manifest>;
      })
      .then((m) => {
        if (cancelled) return;
        setManifest(m);
        setRows(
          Object.entries(m.files).map(([path, entry]) => ({
            path,
            expected: entry.sha256,
            actual: null,
            state: "pending" as RowState,
          })),
        );
        setPhase("idle");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load the manifest");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const verify = useCallback(async () => {
    if (!manifest || phase === "running") return;
    setPhase("running");
    setRows((prev) => prev.map((r) => ({ ...r, actual: null, state: "pending" })));

    for (const [path, entry] of Object.entries(manifest.files)) {
      let next: Partial<Row>;
      try {
        const res = await fetch(`/${path}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const actual = await sha256Hex(await res.arrayBuffer());
        next = { actual, state: actual === entry.sha256 ? "match" : "mismatch" };
      } catch {
        next = { actual: null, state: "error" };
      }
      setRows((prev) => prev.map((r) => (r.path === path ? { ...r, ...next } : r)));
    }

    setPhase("done");
  }, [manifest, phase]);

  const checked = rows.filter((r) => r.state !== "pending").length;
  const matched = rows.filter((r) => r.state === "match").length;
  const failed = rows.filter((r) => r.state === "mismatch" || r.state === "error").length;
  const allGood = phase === "done" && failed === 0 && matched === rows.length && rows.length > 0;

  return (
    <MarketingPage
      eyebrow="Build Transparency"
      title="Hash the code your browser is running."
      lead="Every client asset we ship is listed below with its SHA-256. Your browser can re-hash each one right now and tell you whether it matches."
    >
      <div className="info-hero-grid">
        <StatCard
          label="Assets published"
          value={manifest ? String(manifest.fileCount) : "—"}
          hint="Client JS and CSS"
        />
        <StatCard label="Digest" value="SHA-256" hint="Computed via WebCrypto" />
        <StatCard
          label="Bundle size"
          value={manifest ? `${Math.round(manifest.totalBytes / 1024)} KB` : "—"}
          hint={manifest ? `Built ${new Date(manifest.builtAt).toUTCString()}` : "Loading"}
        />
      </div>

      <section className="vf" aria-label="Live build verification">
        <header className="vf__head">
          <div>
            <span className="vf__label">Live check</span>
            <p className="vf__status" aria-live="polite">
              {phase === "error" && <span className="vf__bad">{error}</span>}
              {phase === "loading" && "Loading manifest…"}
              {phase === "idle" && manifest && `${rows.length} assets ready to verify`}
              {phase === "running" && `Hashing ${checked} / ${rows.length}…`}
              {phase === "done" &&
                (allGood ? (
                  <span className="vf__good">
                    All {matched} assets match the published manifest
                  </span>
                ) : (
                  <span className="vf__bad">
                    {failed} of {rows.length} did not match
                  </span>
                ))}
            </p>
          </div>
          <button
            type="button"
            className="vf__run"
            onClick={verify}
            disabled={!manifest || phase === "running"}
          >
            {phase === "running" ? "Hashing…" : phase === "done" ? "Run again" : "Verify now"}
          </button>
        </header>

        <ol className="vf__rows">
          {rows.map((row) => (
            <li className={`vf__row is-${row.state}`} key={row.path}>
              <span className="vf__row-name">{row.path.replace(/^assets\//, "")}</span>
              <code className="vf__row-hash">
                {row.actual ? `${row.actual.slice(0, 16)}…` : `${row.expected.slice(0, 16)}…`}
              </code>
              <span className="vf__row-state">
                {row.state === "pending" && "—"}
                {row.state === "match" && "match"}
                {row.state === "mismatch" && "MISMATCH"}
                {row.state === "error" && "unreachable"}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Section number="01 / WHAT THIS PROVES" title="The bundle you got is the bundle we listed.">
        <p>
          The check above downloads each JavaScript and CSS file your browser executes, hashes it
          with the WebCrypto API, and compares the result to{" "}
          <a href={MANIFEST_URL} className="text-link text-link--dark vf__inline-link">
            build-manifest.json
            <ArrowUpRight className="size-4" />
          </a>{" "}
          — the manifest generated at build time. If a file were altered in transit, by a CDN, or by
          anything between our server and you, its hash would change and the row would read
          MISMATCH.
        </p>
      </Section>

      <Section
        number="02 / WHAT IT DOES NOT PROVE"
        title="A dishonest server could serve you both."
      >
        <p>
          Be clear-eyed about the limit: the manifest is served by the same origin as the code. An
          operator who wanted to ship you malicious JavaScript could publish a manifest matching it,
          and this page would show green. Comparing a file against a description of itself is not
          proof of anything on its own.
        </p>
        <p>
          That is why the same manifest is committed to the public repository. GitHub is a separate
          trust domain — we cannot alter what is already published there without it being visible.
          Compare the two, and the claim becomes checkable by someone other than us.
        </p>
        <a
          href={REPO_MANIFEST_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="text-link text-link--dark"
        >
          Compare against the manifest on GitHub
          <Github className="size-4" />
        </a>
      </Section>

      <Section number="03 / NOT YET REPRODUCIBLE" title="Rebuilding may not give you these hashes.">
        <p>
          This is bundle transparency, not a reproducible build. Our build output is not yet
          guaranteed byte-identical across machines, so cloning the repo and running{" "}
          <code>bun run build</code> can legitimately produce different hashes. We would rather say
          that plainly than let a green checkmark imply more than it earns. Making the build
          deterministic is the next step, and until it lands, treat this page as evidence about
          delivery — not about provenance.
        </p>
      </Section>
    </MarketingPage>
  );
}
