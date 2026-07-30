import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Github, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ContributeModal } from "@/components/ContributeModal";
import { ScrollToTop } from "@/components/ScrollToTop";

export function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.body.classList.add("mobile-nav-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("mobile-nav-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="marketing-header">
      <div className="marketing-shell marketing-header__inner">
        <Link to="/" className="brand-lockup shrink-0" aria-label="SEES home">
          <BrandMark variant="wordmark" />
        </Link>

        <div className="site-nav__actions">
          <Link to="/access" className="nav-cta">
            Enter vault
            <ArrowUpRight className="size-3.5" strokeWidth={1.8} />
          </Link>
          <button
            type="button"
            className={`mobile-menu-toggle ${menuOpen ? "is-open" : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="marketing-site-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>{menuOpen ? "Close" : "Menu"}</span>
            {menuOpen ? (
              <X className="size-4" strokeWidth={1.7} />
            ) : (
              <Menu className="size-4" strokeWidth={1.7} />
            )}
          </button>
        </div>
      </div>
      <div
        id="marketing-site-menu"
        className={`mobile-menu-panel ${menuOpen ? "is-open" : ""}`}
      >
        <div className="marketing-shell mobile-menu-panel__inner mobile-menu-panel__inner--marketing">
          <Link to="/security" onClick={closeMenu}>
            <span>01</span>
            Security
          </Link>
          <Link to="/privacy" onClick={closeMenu}>
            <span>02</span>
            Privacy
          </Link>
          <Link to="/terms" onClick={closeMenu}>
            <span>03</span>
            Terms
          </Link>
          <Link to="/faq" onClick={closeMenu}>
            <span>04</span>
            FAQ
          </Link>
          <Link to="/contact" onClick={closeMenu}>
            <span>05</span>
            Contact
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingPage({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-site min-h-screen bg-background text-foreground flex flex-col">
      <MarketingHeader />

      <main className="marketing-main flex-1">
        <div className="marketing-shell">
          <div className="marketing-hero">
            <div className="marketing-hero__index" aria-hidden>
              SE / INFO
            </div>
            <div className="marketing-hero__copy">
              {eyebrow && <div className="marketing-eyebrow">{eyebrow}</div>}
              <h1>{title}</h1>
              {lead && <p className="marketing-lead">{lead}</p>}
            </div>
            <div className="marketing-hero__meta">
              <span>Zero-knowledge</span>
              <span>Architecture v0.1</span>
            </div>
          </div>
          <div className="marketing-content">{children}</div>
        </div>
      </main>

      <MarketingFooter />
      <ScrollToTop />
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="site-footer">
      <div className="marketing-shell">
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
  );
}

export function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="marketing-section">
      <div className="marketing-section__head">
        <span>{number}</span>
        <h2>{title}</h2>
      </div>
      <div className="marketing-section__body">{children}</div>
    </section>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="marketing-pill">
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="marketing-stat">
      <div className="marketing-stat__label">{label}</div>
      <div className="marketing-stat__value">{value}</div>
      {hint && <div className="marketing-stat__hint">{hint}</div>}
    </div>
  );
}
