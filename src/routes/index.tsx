import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Fingerprint,
  Info,
  KeyRound,
  LockKeyhole,
  Github,
  Menu,
  MessageSquareText,
  Network,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { ContributeModal } from "@/components/ContributeModal";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Turnstile } from "@/components/Turnstile";
import { WireframeBackground } from "@/components/WireframeBackground";
import { useReveal } from "@/hooks/useReveal";
import { deriveKey, encryptString, fingerprint, randomBytes } from "@/lib/crypto";
import { submitContactMessage } from "@/lib/storj.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://www.sees.im/" }],
  }),
  component: LandingPage,
});

const protocolSteps = [
  {
    index: "01",
    eyebrow: "Identity",
    title: "Claim a name.\nReveal nothing.",
    body: "Your Vault ID is a locator, not a profile. No email, phone number, recovery address, or personal account is ever attached.",
    icon: Fingerprint,
  },
  {
    index: "02",
    eyebrow: "Seal",
    title: "Encrypt here.\nThen transmit.",
    body: "Your passphrase becomes a 256-bit key inside your browser. Every byte is sealed locally before it touches the network.",
    icon: LockKeyhole,
  },
  {
    index: "03",
    eyebrow: "Distribute",
    title: "Store everywhere.\nTrust nowhere.",
    body: "Ciphertext is distributed across Storj. Nodes hold fragments they cannot understand. SEES never receives your key.",
    icon: Network,
  },
];

const HOME_FAQ: [string, string][] = [
  [
    "What happens if I forget my passphrase?",
    "Your vault becomes unreadable. There is no reset email and no recovery key — that trade-off is what makes zero-knowledge possible.",
  ],
  [
    "Can SEES read my notes?",
    "No. Notes are encrypted in your browser before they ever reach storage, and SEES never receives the key that could decrypt them.",
  ],
  [
    "Has SEES been audited?",
    "Not yet. We'd rather say that plainly than hide behind a security badge — treat it as early-stage software until an independent audit is published.",
  ],
];

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const proofRef = useReveal<HTMLElement>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("contributed") !== "1") return;
    toast.success("Contribution received", {
      description: "Thank you for supporting independent privacy software.",
    });
    params.delete("contributed");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.body.classList.add("mobile-nav-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("mobile-nav-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="sees-site min-h-screen overflow-x-hidden bg-background text-foreground">
      <header
        className={`site-nav ${scrolled || mobileMenuOpen ? "site-nav--scrolled" : ""}`}
      >
        <div className="site-shell flex h-[76px] items-center justify-between">
          <Link to="/" className="brand-lockup" aria-label="SEES home">
            <BrandMark variant="wordmark" />
          </Link>
          <div className="site-nav__actions">
            <Link to="/access" className="nav-cta">
              Enter vault
              <ArrowUpRight className="size-3.5" strokeWidth={1.8} />
            </Link>
            <button
              type="button"
              className={`mobile-menu-toggle ${mobileMenuOpen ? "is-open" : ""}`}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-site-menu"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span>{mobileMenuOpen ? "Close" : "Menu"}</span>
              {mobileMenuOpen ? (
                <X className="size-4" strokeWidth={1.7} />
              ) : (
                <Menu className="size-4" strokeWidth={1.7} />
              )}
            </button>
          </div>
        </div>
        <div
          id="mobile-site-menu"
          className={`mobile-menu-panel ${mobileMenuOpen ? "is-open" : ""}`}
        >
          <div className="site-shell mobile-menu-panel__inner">
            <Link to="/security" onClick={closeMobileMenu}>
              <span>01</span>
              Security
            </Link>
            <Link to="/privacy" onClick={closeMobileMenu}>
              <span>02</span>
              Privacy
            </Link>
            <Link to="/terms" onClick={closeMobileMenu}>
              <span>03</span>
              Terms
            </Link>
            <Link to="/faq" onClick={closeMobileMenu}>
              <span>04</span>
              FAQ
            </Link>
            <Link to="/contact" onClick={closeMobileMenu}>
              <span>05</span>
              Contact
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-glow" aria-hidden />
          <div className="hero-wireframe" aria-hidden>
            <WireframeBackground />
          </div>
          <div className="site-shell hero-home-layout relative z-10 grid min-h-[calc(100svh-76px)] items-start pb-12 pt-10 lg:pb-24 lg:pt-24">
            <div className="hero-copy">
              <div className="eyebrow-pill">
                <span className="status-pulse" />
                Private by architecture
              </div>
              <h1 className="hero-title">
                No one
                <span className="hero-title__line">
                  but <em>you.</em>
                </span>
              </h1>
              <div className="mt-8 max-w-2xl">
                <p className="max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
                  A zero-knowledge vault for your private state — sealed locally, stored
                  distributed, readable only by you.
                </p>
              </div>
              <div className="mt-8 hero-cta-wrap">
                <Link to="/access" search={{ mode: "create" }} className="hero-cta">
                  Claim your vault
                  <ArrowUpRight className="hero-cta__icon size-4" strokeWidth={2} />
                </Link>
                <p className="hero-cta-note">
                  <LockKeyhole className="size-3.5" strokeWidth={2} />
                  No account, email, or data required.
                </p>
              </div>
              <div className="hero-trust-row">
                <TrustStat value="0" label="Personal data required" />
                <TrustStat value="256" label="Bit local encryption" />
                <TrustStat value="∞" label="Devices, one vault" />
              </div>
            </div>
          </div>
          <div className="hero-scroll-cue">
            <span>Scroll to explore</span>
            <a href="#protocol" className="round-arrow" aria-label="Discover the SEES protocol">
              <ArrowDown className="size-5" strokeWidth={1.5} />
            </a>
          </div>
          <div className="hero-index hidden xl:block" aria-hidden>
            00—03
          </div>
        </section>

        <div className="signal-strip" aria-label="Security specifications">
          <div className="signal-track">
            {Array.from({ length: 2 }).map((_, duplicate) => (
              <div className="signal-rail" key={duplicate} aria-hidden={duplicate === 1}>
                {["AES-256-GCM", "PBKDF2 · 250,000", "ZERO KNOWLEDGE", "STORJ DISTRIBUTED", "NO RECOVERY KEY"].map(
                  (label, index) => (
                    <span className="signal-item" key={label}>
                      <span className="signal-number">{String(index + 1).padStart(2, "0")}</span>
                      <span>{label}</span>
                    </span>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <section id="protocol" className="protocol-section">
          <div className="site-shell">
            <SectionIntro
              number="01"
              kicker="The protocol"
              title={"Simple on the surface.\nUncompromising underneath."}
              body="Privacy should not depend on a promise. SEES removes the need to trust us in the first place."
            />
            <div className="protocol-grid">
              {protocolSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <article className="protocol-card" key={step.index}>
                    <div className="flex items-start justify-between">
                      <span className="protocol-index">{step.index}</span>
                      <Icon className="size-5 text-brand" strokeWidth={1.5} aria-hidden />
                    </div>
                    <div>
                      <p className="protocol-eyebrow">{step.eyebrow}</p>
                      <h3>{step.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h3>
                      <p>{step.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="proof" ref={proofRef} className="reveal proof-section">
          <div className="site-shell proof-grid">
            <div className="proof-copy">
              <span className="section-number">02</span>
              <p className="section-kicker">Proof, not promises</p>
              <h2>Your key has never met our server.</h2>
              <p>
                Encryption happens in your browser. Only unreadable ciphertext leaves your device,
                so a breach of our infrastructure cannot expose what we never possessed.
              </p>
              <Link to="/security" className="text-link">
                Read the security model
                <ArrowRight className="size-4" />
              </Link>
              <a href="#live-proof" className="proof-honesty">
                <Info className="size-3.5" strokeWidth={1.6} />
                Don't take our word for it — watch your own browser prove it below.
              </a>
            </div>
            <div className="cipher-visual" aria-label="Encryption flow diagram">
              <div className="cipher-grid" aria-hidden />
              <div className="cipher-node cipher-node--source">
                <KeyRound className="size-5" strokeWidth={1.4} />
                <span>your key</span>
              </div>
              <div className="cipher-line">
                <span />
                <span />
                <span />
              </div>
              <div className="cipher-core">
                <div className="cipher-core__ring" />
                <LockKeyhole className="size-9 text-background" strokeWidth={1.5} />
              </div>
              <div className="cipher-output">
                {["7B", "A3", "F9", "02", "D1", "4E", "8C", "6A"].map((byte) => (
                  <span key={byte}>{byte}</span>
                ))}
              </div>
              <div className="cipher-caption">
                <ShieldCheck className="size-4 text-brand" />
                Only ciphertext crosses this boundary
              </div>
            </div>
          </div>
          <div id="live-proof" className="site-shell">
            <CryptoDemo />
          </div>
        </section>

        <section className="home-faq">
          <div className="site-shell">
            <SectionIntro
              number="03"
              kicker="Before you ask"
              title={"Straight answers.\nNo soft-focus privacy theater."}
              body="The questions people ask before trusting an encrypted vault with their private life."
            />
            <div className="home-faq-grid">
              {HOME_FAQ.map(([q, a]) => (
                <div className="home-faq-item" key={q}>
                  <p className="home-faq-item__q">{q}</p>
                  <p className="home-faq-item__a">{a}</p>
                </div>
              ))}
            </div>
            <Link to="/faq" className="text-link text-link--dark">
              Read the full FAQ
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="manifesto-section">
          <div className="site-shell">
            <p className="section-kicker">Built on one belief</p>
            <h2>
              Your private life should not be someone else&apos;s
              <span> business model.</span>
            </h2>
            <div className="manifesto-foot">
              <p>No ads. No profiles. No backdoors. No forgotten database with your secrets in it.</p>
              <Link to="/access" search={{ mode: "create" }} className="hero-cta">
                Claim your vault
                <ArrowUpRight className="hero-cta__icon size-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </section>

      </main>

      <footer className="site-footer">
        <div className="site-shell">
          <div className="footer-top">
            <div>
              <BrandMark variant="wordmark" className="brand-logo--footer" />
            </div>
            <p>Not even we can read it.</p>
          </div>
          <div className="footer-bottom">
            <span>© 2026 SEES. All rights reserved.</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/security">Security</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/faq">FAQ</Link>
              <Link to="/contact">Contact</Link>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/sees-im/sees"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SEES on GitHub — open source"
                className="open-source-badge"
              >
                <Github className="size-3.5" strokeWidth={1.8} />
                Open source
              </a>
              <ContributeModal />
              <span className="flex items-center gap-2"><span className="status-pulse" /> SEES online</span>
            </div>
          </div>
        </div>
      </footer>
      <ScrollToTop />
    </div>
  );
}

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("General");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "incomplete">("idle");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && email.trim().length > 3 && email.includes("@") && topic.trim().length > 0 && message.trim().length >= 3 && !!turnstileToken;

  useEffect(() => {
    if (status !== "sent") return;
    const timer = window.setTimeout(() => setStatus("idle"), 4200);
    return () => window.clearTimeout(timer);
  }, [status]);

  const updateDraft = (setter: (value: string) => void, value: string) => {
    setter(value);
    if (status === "sent" || status === "error" || status === "incomplete") setStatus("idle");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "sending") return;
    if (!canSubmit) {
      setStatus("incomplete");
      return;
    }
    if (!turnstileToken) {
      setStatus("incomplete");
      return;
    }
    setStatus("sending");
    try {
      await submitContactMessage({
        data: {
          name: name.trim(),
          email: email.trim(),
          topic: topic.trim(),
          message: message.trim(),
          turnstileToken,
        },
      });
      setStatus("sent");
      setName("");
      setEmail("");
      setTopic("General");
      setMessage("");
      setTurnstileToken(null);
    } catch {
      setStatus("error");
    }
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-form__header">
        <div>
          <p>Signal desk / 03</p>
          <h3>Start a conversation.</h3>
          <span>We keep the details, not the data.</span>
        </div>
        <div className="contact-form__header-icon"><MessageSquareText className="size-5" strokeWidth={1.5} aria-hidden /></div>
      </div>

      <div className="contact-fields">
        <div className="contact-fields__row">
          <label>
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => updateDraft(setName, event.target.value)}
              placeholder="Full name"
              maxLength={80}
              autoComplete="name"
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => updateDraft(setEmail, event.target.value)}
              placeholder="you@company.com"
              maxLength={160}
              autoComplete="email"
              required
            />
          </label>
        </div>
        <label>
          <span>Topic</span>
          <select value={topic} onChange={(event) => updateDraft(setTopic, event.target.value)}>
            <option>General</option>
            <option>Bug report</option>
            <option>Security</option>
            <option>Storage setup</option>
          </select>
        </label>
        <label className="contact-fields__message">
          <span>Transmission</span>
          <textarea
            value={message}
            onChange={(event) => updateDraft(setMessage, event.target.value)}
            placeholder="Describe the signal, issue, or request..."
            maxLength={2000}
            rows={6}
          />
        </label>
      </div>

      <Turnstile onVerify={setTurnstileToken} />

      {status === "sent" && (
        <div className="contact-status contact-status--rich is-sent" role="status">
          <div className="contact-status__icon">
            <CheckCircle2 className="size-4" strokeWidth={1.8} />
          </div>
          <div className="contact-status__copy">
            <strong>Transmission sealed.</strong>
            <span>Message received — thanks. Your note is queued privately.</span>
          </div>
          <div className="contact-status__tag">Delivered</div>
        </div>
      )}
      {status === "error" && <p className="contact-status is-error">Could not send. Try again.</p>}
      {status === "incomplete" && (
        <p className="contact-status">
          {turnstileToken ? "Add your name, email, and transmission to send." : "Complete the verification check above, then send."}
        </p>
      )}

      <button type="submit" className="contact-submit" disabled={!canSubmit || status === "sending"}>
        <span>{status === "sending" ? "Sending..." : "Send message"}</span>
        <Send className="size-4" strokeWidth={1.7} />
      </button>
    </form>
  );
}

const DEMO_MESSAGE = "SEES never sees this.";

function CryptoDemo() {
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ms: number; fingerprint: string; cipherPreview: string } | null>(null);

  useEffect(() => {
    if (!passphrase) {
      setResult(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const start = performance.now();
      const salt = randomBytes(16);
      const [key, fp] = await Promise.all([
        deriveKey(passphrase, salt),
        fingerprint(passphrase, salt),
      ]);
      const blob = await encryptString(key, DEMO_MESSAGE);
      const ms = performance.now() - start;
      if (cancelled) return;
      setResult({ ms, fingerprint: fp, cipherPreview: `${blob.data.slice(0, 44)}…` });
      setBusy(false);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [passphrase]);

  return (
    <div className="crypto-demo">
      <div className="crypto-demo__head">
        <p className="section-kicker">Try it. Right now.</p>
        <h3>Type anything. Watch your browser do the real math.</h3>
        <p>
          This runs entirely in this browser tab — PBKDF2-SHA256 at 250,000 iterations, then
          AES-256-GCM. Nothing you type here is sent anywhere or stored.
        </p>
      </div>
      <div className="crypto-demo__panel">
        <div>
          <input
            type="text"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Type anything…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Demo passphrase (not saved, not sent anywhere)"
          />
          <p className="crypto-demo__hint">Nothing here touches a server. Refresh and it's gone.</p>
        </div>
        <div className="crypto-demo__output">
          <div className="crypto-demo__row">
            <span>Key derivation</span>
            <strong className={result ? "" : "is-muted"}>
              {busy
                ? "Deriving key…"
                : result
                  ? `${result.ms.toFixed(0)}ms · PBKDF2-SHA256 · 250,000 rounds`
                  : "Waiting for input"}
            </strong>
          </div>
          <div className="crypto-demo__row">
            <span>Key fingerprint</span>
            <strong className={result ? "" : "is-muted"}>{result?.fingerprint ?? "—"}</strong>
          </div>
          <div className="crypto-demo__row">
            <span>Sample ciphertext (AES-256-GCM)</span>
            <strong className={result ? "" : "is-muted"}>{result?.cipherPreview ?? "—"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="trust-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SectionIntro({
  number,
  kicker,
  title,
  body,
}: {
  number: string;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="section-intro">
      <span className="section-number">{number}</span>
      <div>
        <p className="section-kicker">{kicker}</p>
        <h2>{title.split("\n").map((line) => <span key={line}>{line}</span>)}</h2>
      </div>
      <p className="section-intro__body">{body}</p>
    </div>
  );
}
