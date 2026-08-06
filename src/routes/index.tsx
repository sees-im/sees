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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { ContributeModal } from "@/components/ContributeModal";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Turnstile } from "@/components/Turnstile";
import { WireframeBackground } from "@/components/WireframeBackground";
import { useRevealAll } from "@/hooks/useReveal";
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
    href: "/protocol/identity",
  },
  {
    index: "02",
    eyebrow: "Seal",
    title: "Encrypt here.\nThen transmit.",
    body: "Your passphrase becomes a 256-bit key inside your browser. Every byte is sealed locally before it touches the network.",
    icon: LockKeyhole,
    href: "/protocol/seal",
  },
  {
    index: "03",
    eyebrow: "Distribute",
    title: "Store everywhere.\nTrust nowhere.",
    body: "Ciphertext is distributed across Storj. Nodes hold fragments they cannot understand. SEES never receives your key.",
    icon: Network,
    href: "/protocol/distribute",
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

const COMPARISON_RIVALS = ["Notion", "Standard Notes", "Obsidian + Sync"];

const comparisonRows: { label: string; sees: string; rivals: [string, string, string] }[] = [
  {
    label: "To sign up you hand over",
    sees: "Nothing at all",
    rivals: ["Email + profile", "Email account", "Email for Sync"],
  },
  {
    label: "Who holds the key",
    sees: "You — derived in your browser",
    rivals: ["Their servers", "You", "You, on Sync"],
  },
  {
    label: "Where your ciphertext lives",
    sees: "Distributed across Storj nodes",
    rivals: ["One corporate cloud", "One corporate cloud", "Your disk + paid cloud"],
  },
  {
    label: "Linkable back to you",
    sees: "Nothing exists to link",
    rivals: ["Account-bound", "Account-bound", "Account-bound"],
  },
  {
    label: "Cost of the full privacy model",
    sees: "Free, all of it",
    rivals: ["Not offered", "Paid tier", "Paid Sync"],
  },
  {
    label: "Source code",
    sees: "Open, MIT licensed",
    rivals: ["Closed", "Open", "Closed"],
  },
  {
    label: "How you verify the claims",
    sees: "Live proof in your own tab",
    rivals: ["Read the policy", "Read the policy", "Read the policy"],
  },
  {
    label: "Time to your first note",
    sees: "One passphrase, any browser",
    rivals: ["Account + app", "Account + app", "Install + configure"],
  },
];

const signalItems = [
  { label: "AES-256-GCM" },
  { label: "PBKDF2 · 250,000" },
  { label: "ZERO KNOWLEDGE" },
  { label: "STORJ DISTRIBUTED", logo: true },
  { label: "NO RECOVERY KEY" },
];

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useRevealAll();

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
      <header className={`site-nav ${scrolled || mobileMenuOpen ? "site-nav--scrolled" : ""}`}>
        <div className="site-shell flex h-[76px] items-center justify-between">
          <Link to="/" className="brand-lockup" aria-label="SEES home">
            <BrandMark variant="wordmark" />
          </Link>
          <div className="site-nav__actions">
            <ContributeModal variant="nav" />
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
            <Link to="/docs" onClick={closeMobileMenu}>
              <span>05</span>
              Docs
            </Link>
            <Link to="/contact" onClick={closeMobileMenu}>
              <span>06</span>
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
                <ScrambleText text="Private by architecture" delay={0} />
              </div>
              <h1 className="hero-title">
                No one
                <span className="hero-title__line">
                  but <em>you.</em>
                </span>
              </h1>
              <div className="mt-8 max-w-2xl">
                <p className="max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
                  <ScrambleText
                    text="A zero-knowledge vault for your private state — sealed locally, stored distributed, readable only by you."
                    delay={140}
                    stable
                  />
                </p>
              </div>
              <div className="mt-8 hero-cta-wrap">
                <Link to="/access" search={{ mode: "create" }} className="hero-cta">
                  <ScrambleText text="Claim your vault" delay={420} />
                  <ArrowUpRight className="hero-cta__icon size-4" strokeWidth={2} />
                </Link>
                <p className="hero-cta-note">
                  <LockKeyhole className="size-3.5" strokeWidth={2} />
                  <ScrambleText text="No account, email, or data required." delay={480} />
                </p>
              </div>
              <div className="hero-trust-row">
                <TrustStat value="0" label="Personal data required" delay={620} />
                <TrustStat value="256" label="Bit local encryption" delay={760} />
                <TrustStat value="∞" label="Devices, one vault" delay={900} />
              </div>
            </div>
          </div>
          <div className="hero-scroll-cue">
            <span>Scroll to explore</span>
            <a
              href="#security-specs"
              className="round-arrow"
              aria-label="Discover the SEES protocol"
            >
              <ArrowDown className="size-5" strokeWidth={1.5} />
            </a>
          </div>
          <div className="hero-index hidden xl:block" aria-hidden>
            00—04
          </div>
        </section>

        <div id="security-specs" className="signal-strip" aria-label="Security specifications">
          <div className="signal-track">
            {Array.from({ length: 2 }).map((_, duplicate) => (
              <div className="signal-rail" key={duplicate} aria-hidden={duplicate === 1}>
                {signalItems.map((item, index) => (
                  <span
                    className={`signal-item ${item.logo ? "signal-item--logo" : ""}`}
                    key={item.label}
                  >
                    <span className="signal-number">{String(index + 1).padStart(2, "0")}</span>
                    {item.logo ? (
                      <span className="storj-signal-lockup">
                        <img src="/storj-logo-full-white.svg" alt="Storj" />
                        <span>Distributed</span>
                      </span>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section data-reveal id="protocol" className="protocol-section">
          <div id="protocol-intro" className="site-shell">
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
                  <Link
                    to={step.href}
                    className="protocol-card"
                    key={step.index}
                    aria-label={`Open ${step.eyebrow} protocol detail`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="protocol-index">{step.index}</span>
                      <span className="protocol-card__icon">
                        <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                        <ArrowUpRight
                          className="protocol-card__arrow size-4"
                          strokeWidth={1.6}
                          aria-hidden
                        />
                      </span>
                    </div>
                    <div>
                      <p className="protocol-eyebrow">{step.eyebrow}</p>
                      <h3>
                        {step.title.split("\n").map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </h3>
                      <p>{step.body}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section id="proof" data-reveal className="proof-section">
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

        <section data-reveal id="comparison" className="comparison-section">
          <div className="site-shell">
            <SectionIntro
              number="03"
              kicker="The comparison"
              title={"What they ask for.\nWhat we never need."}
              body="Same notes. A completely different architecture underneath — and a shorter list of things you have to hand over."
            />
            <ComparisonExchange />
          </div>
        </section>

        <section data-reveal className="home-faq">
          <div className="site-shell">
            <SectionIntro
              number="04"
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

        <section data-reveal className="manifesto-section">
          <div className="site-shell">
            <p className="section-kicker">Built on one belief</p>
            <h2>
              Your private life should not be someone else&apos;s
              <span> business model.</span>
            </h2>
            <div className="manifesto-foot">
              <p>
                No ads. No profiles. No backdoors. No forgotten database with your secrets in it.
              </p>
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
            <div className="footer-brand-block">
              <BrandMark variant="wordmark" className="brand-logo--footer" />
              <span>Zero-knowledge notes. Sealed locally.</span>
            </div>
            <p>Not even we can read it.</p>
          </div>
          <div className="footer-bottom">
            <span>© 2026 SEES. All rights reserved.</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/security">Security</Link>
              <Link to="/verify">Verify build</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/faq">FAQ</Link>
              <Link to="/docs">Docs</Link>
              <Link to="/blog">Writing</Link>
              <Link to="/contact">Contact</Link>
              {/* Plain anchor: /404 is the catch-all, not a route, so this has
                  to hit the server to render the real not-found response. */}
              <a href="/404">404</a>
            </div>
            <div className="footer-actions flex items-center gap-4">
              <div className="footer-actions__badges">
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
              </div>
              <span className="footer-status flex items-center gap-2 whitespace-nowrap">
                <span className="status-pulse" /> All systems operational
              </span>
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
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "incomplete">(
    "idle",
  );
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 3 &&
    email.includes("@") &&
    topic.trim().length > 0 &&
    message.trim().length >= 3 &&
    !!turnstileToken;

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
        <div className="contact-form__header-icon">
          <MessageSquareText className="size-5" strokeWidth={1.5} aria-hidden />
        </div>
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
          {turnstileToken
            ? "Add your name, email, and transmission to send."
            : "Complete the verification check above, then send."}
        </p>
      )}

      <button
        type="submit"
        className="contact-submit"
        disabled={!canSubmit || status === "sending"}
      >
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
  const [result, setResult] = useState<{
    ms: number;
    fingerprint: string;
    cipherPreview: string;
  } | null>(null);

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

function ComparisonExchange() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const row = comparisonRows[active];

  // Roving tabindex: one tab stop for the whole rail, arrows move within it.
  const onTabKey = (event: React.KeyboardEvent) => {
    const last = comparisonRows.length - 1;
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? active === last
          ? 0
          : active + 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? active === 0
            ? last
            : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <div className="cmp">
        <div className="cmp-rail" role="tablist" aria-label="Comparison dimensions">
          {comparisonRows.map((item, index) => (
            <button
              type="button"
              role="tab"
              key={item.label}
              id={`cmp-tab-${index}`}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              className={`cmp-rail__item${index === active ? " is-active" : ""}`}
              aria-selected={index === active}
              aria-controls="cmp-answer-panel"
              tabIndex={index === active ? 0 : -1}
              onKeyDown={onTabKey}
              onFocus={() => setActive(index)}
              onClick={() => setActive(index)}
            >
              <span className="cmp-rail__n">{String(index + 1).padStart(2, "0")}</span>
              <span className="cmp-rail__label">{item.label}</span>
            </button>
          ))}
        </div>

        <div
          className="cmp-panel"
          role="tabpanel"
          id="cmp-answer-panel"
          aria-labelledby={`cmp-tab-${active}`}
          aria-live="polite"
          tabIndex={0}
        >
          <span className="cmp-panel__ghost" aria-hidden>
            {String(active + 1).padStart(2, "0")}
          </span>
          <div className="cmp-panel__head">
            <BrandMark variant="wordmark" className="cmp-panel__mark" />
            <span className="cmp-panel__tag">
              <span className="status-pulse" />
              Sealed
            </span>
          </div>
          <div className="cmp-panel__body">
            <p className="cmp-panel__q">{row.label}</p>
            {/* Keyed so the answer re-scrambles on every switch — the vault decrypting on demand. */}
            <h3 className="cmp-panel__a">
              <ScrambleText key={active} text={row.sees} stable />
            </h3>
          </div>
          <div className="cmp-panel__others">
            <span className="cmp-panel__others-label">Everyone else</span>
            {COMPARISON_RIVALS.map((name, index) => (
              <div className="cmp-other" key={name}>
                <span className="cmp-other__name">{name}</span>
                <span className="cmp-other__leader" aria-hidden />
                <span className="cmp-other__value">{row.rivals[index]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cmp-foot">
        <p>The source is public — every row above is something you can check for yourself.</p>
        <div className="cmp-foot__links">
          <Link to="/security" className="text-link">
            Read the security model
            <ArrowRight className="size-4" />
          </Link>
          <Link to="/verify" className="text-link">
            Hash the bundle you're running
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </>
  );
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/\\";

function ScrambleText({
  text,
  delay = 0,
  stable = false,
}: {
  text: string;
  delay?: number;
  stable?: boolean;
}) {
  const displayRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const display = displayRef.current;
    const root = rootRef.current;
    if (!display || !root) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      display.textContent = text;
      return;
    }

    let raf = 0;
    let timeout = 0;
    let cancelled = false;
    const duration = Math.min(1100, 420 + text.length * 10);

    const scramble = () => {
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min((now - start) / duration, 1);
        const revealCount = Math.floor(progress * text.length);
        display.textContent = text
          .split("")
          .map((ch, i) => {
            if (ch === " " || i < revealCount) return ch;
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          })
          .join("");
        if (progress < 1) raf = requestAnimationFrame(tick);
        else display.textContent = text;
      };
      raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        timeout = window.setTimeout(scramble, delay);
      },
      { threshold: 0.4 },
    );
    observer.observe(root);

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [text, delay]);

  return (
    <span
      ref={rootRef}
      className={stable ? "scramble-text scramble-text--stable" : undefined}
      aria-label={text}
    >
      {stable && (
        <span className="scramble-text__layout" aria-hidden="true">
          {text}
        </span>
      )}
      <span
        ref={displayRef}
        className={stable ? "scramble-text__display" : undefined}
        aria-hidden="true"
      >
        {text}
      </span>
    </span>
  );
}

function TrustStat({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) {
  return (
    <div className="trust-stat">
      <strong>
        <ScrambleText text={value} delay={delay} />
      </strong>
      <span>
        <ScrambleText text={label} delay={delay + 120} />
      </span>
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
        <h2>
          {title.split("\n").map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h2>
      </div>
      <p className="section-intro__body">{body}</p>
    </div>
  );
}
