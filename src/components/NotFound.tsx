import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { BrandMark } from "./BrandMark";

const GLYPHS = "ABCDEF0123456789#%&*+=/\\";
const TARGET = "404";
const ITERATIONS = 250_000;
const RUN_MS = 2200;

const STAGES = [
  "Reading path…",
  "Deriving key — PBKDF2-SHA256…",
  "Stretching passphrase…",
  "Opening sealed blob…",
];

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

function toHex(input: string): string {
  return Array.from(new TextEncoder().encode(input))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function randomFingerprint(): string {
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0"),
  )
    .join("")
    .toUpperCase()
    .replace(/(.{4})(?=.)/g, "$1-");
}

// The "404" never resolves for long — it re-scrambles, the way a blob without
// a key never settles into plaintext. Held still for reduced-motion users.
function useScrambledCode(reduced: boolean): string {
  const [text, setText] = useState(TARGET);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      // Settle on the real digits for a beat every ~2s, then dissolve again.
      const settled = frame % 24 > 18;
      setText(
        TARGET.split("")
          .map((ch, i) => (settled || (frame + i) % 7 === 0 ? ch : randomGlyph()))
          .join(""),
      );
    }, 90);
    return () => window.clearInterval(id);
  }, [reduced]);

  return text;
}

export function NotFound() {
  const [reduced, setReduced] = useState(false);
  const [path, setPath] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(STAGES[0]);
  const [attempted, setAttempted] = useState("");
  const shellRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const code = useScrambledCode(reduced);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    setPath(window.location.pathname);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Cursor drives a light source behind the grid — cheap, no canvas.
  useEffect(() => {
    if (reduced) return;
    const el = shellRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, [reduced]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const attempt = useCallback(() => {
    if (phase === "running") return;
    setPhase("running");
    setProgress(0);
    setAttempted("");

    if (reduced) {
      setProgress(1);
      setStage(STAGES[STAGES.length - 1]);
      setAttempted(randomFingerprint());
      setPhase("failed");
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / RUN_MS, 1);
      setProgress(t);
      setStage(STAGES[Math.min(Math.floor(t * STAGES.length), STAGES.length - 1)]);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setAttempted(randomFingerprint());
        setPhase("failed");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [phase, reduced]);

  const iterationsShown = Math.round(progress * ITERATIONS).toLocaleString("en-US");

  return (
    <main className="nf" ref={shellRef}>
      <div className="nf__grid" aria-hidden />
      <div className="nf__glow" aria-hidden />

      <div className="nf__inner">
        <Link to="/" className="nf__brand" aria-label="SEES — home">
          <BrandMark variant="wordmark" />
        </Link>

        <span className="nf__tag">
          <span className="status-pulse" />
          Decryption failed
        </span>

        <h1 className="nf__code" aria-label="404">
          <span aria-hidden>{code}</span>
        </h1>

        <p className="nf__lede">This path has no key.</p>
        <p className="nf__body">
          The address you followed doesn&rsquo;t resolve to anything we hold. That&rsquo;s not a
          broken link so much as the whole idea — nothing here can be opened without the key that
          seals it, and this one was never sealed at all.
        </p>

        <section className="nf__console" aria-label="Decryption attempt">
          <header className="nf__console-head">
            <span className="nf__console-label">Requested path</span>
            <span className="nf__console-dot" aria-hidden />
          </header>

          <p className="nf__cipher" title={path}>
            {path ? toHex(path) : "—"}
          </p>

          <div className="nf__meter" role="presentation">
            <div
              className={`nf__meter-fill${phase === "failed" ? " is-failed" : ""}`}
              style={{ transform: `scaleX(${phase === "idle" ? 0 : progress})` }}
            />
          </div>

          <div className="nf__readout" aria-live="polite">
            {phase === "idle" && <span className="nf__muted">Awaiting attempt</span>}
            {phase === "running" && (
              <>
                <span>{stage}</span>
                <span className="nf__count">{iterationsShown} / 250,000</span>
              </>
            )}
            {phase === "failed" && (
              <>
                <span className="nf__fail">No key exists for this path</span>
                <span className="nf__count">tried {attempted}</span>
              </>
            )}
          </div>

          <button type="button" className="nf__attempt" onClick={attempt}>
            {phase === "running"
              ? "Deriving…"
              : phase === "failed"
                ? "Try again anyway"
                : "Attempt decryption"}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </section>

        <nav className="nf__exits" aria-label="Go elsewhere">
          <Link to="/">Home</Link>
          <Link to="/access">Open a vault</Link>
          <Link to="/docs">Docs</Link>
          <Link to="/security">Security model</Link>
        </nav>
      </div>
    </main>
  );
}
