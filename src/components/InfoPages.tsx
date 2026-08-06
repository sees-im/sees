import { ArrowUpRight, FileDown, Github } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MarketingPage, Pill, Section, StatCard } from "@/components/MarketingPage";

export function SecurityInfoPage() {
  return (
    <MarketingPage
      eyebrow="Security Architecture"
      title="Private by architecture. Sealed before storage."
      lead="A clean look at the actual protocol: where keys live, what the server can see, and which risks SEES does not pretend to solve."
    >
      <div className="info-hero-grid">
        <StatCard label="Server plaintext" value="0 bytes" hint="No key, no readable vault" />
        <StatCard label="Cipher" value="AES-256-GCM" hint="Authenticated encryption" />
        <StatCard label="Key stretch" value="PBKDF2 · 250k" hint="SHA-256, local only" />
      </div>

      <div className="info-flow" aria-label="SEES encryption flow">
        {["Vault ID", "Passphrase", "PBKDF2", "AES key", "Ciphertext"].map((item, index) => (
          <div className="info-flow__step" key={item}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item}
          </div>
        ))}
      </div>

      <a
        href="/sees-whitepaper.pdf"
        download
        className="text-link text-link--dark info-whitepaper-link"
      >
        Download the full protocol whitepaper (PDF)
        <FileDown className="size-4" />
      </a>

      <Section
        number="01 / LOCAL FIRST"
        title="The key is created in your browser, not on our server."
      >
        <p>
          Your passphrase is stretched locally with{" "}
          <strong>PBKDF2-SHA256 using 250,000 iterations</strong>
          and a per-vault salt. The resulting AES key stays in memory while the vault is unlocked.
        </p>
        <pre>{`passphrase + salt
      └─ PBKDF2-SHA256 · 250,000
            └─ AES-256 key · memory only`}</pre>
      </Section>

      <Section
        number="02 / SEALED WRITES"
        title="Every note is encrypted before it touches storage."
      >
        <p>
          Notes are sealed with AES-256-GCM. This gives confidentiality and tamper detection: if
          ciphertext changes, decryption fails instead of silently returning bad data.
        </p>
        <div className="info-pill-row">
          <Pill>No recovery key</Pill>
          <Pill>No plaintext backup</Pill>
          <Pill>No readable admin panel</Pill>
        </div>
      </Section>

      <Section number="03 / SHARING" title="Share a note without creating a copy of the key.">
        <p>
          A share link carries its own encryption key inside the URL fragment — the part of an
          address browsers never send to a server. Locking a share with a password derives that key
          the same way a vault passphrase does.
        </p>
        <div className="info-pill-row">
          <Pill>Key never touches server</Pill>
          <Pill>Optional password</Pill>
          <Pill>Revocable anytime</Pill>
        </div>
      </Section>

      <Section
        number="04 / THREAT MODEL"
        title="Strong against server compromise. Honest about device risk."
      >
        <div className="info-split">
          <InfoBox
            label="Designed to resist"
            items={[
              "Hostile server operator",
              "Storage-node inspection",
              "Network interception",
              "Ciphertext tampering",
            ]}
          />
          <InfoBox
            label="You still control"
            muted
            items={[
              "Device malware",
              "Weak passphrases",
              "Browser extension risk",
              "Sharing credentials",
            ]}
          />
        </div>
      </Section>
    </MarketingPage>
  );
}

export function PrivacyInfoPage() {
  return (
    <MarketingPage
      eyebrow="Privacy Policy"
      title="No account profile. No ad graph. No readable secrets."
      lead="What SEES stores, what infrastructure can observe, and why privacy here starts with removing data instead of promising to behave."
    >
      <div className="info-statement">
        <span>Principle</span>
        If SEES does not need it to operate the vault, SEES should not collect it.
      </div>

      <Section number="01 / COLLECTED" title="You do not need an email, phone, or profile.">
        <p>
          SEES does not ask for an account identity. The app may still involve standard connection
          metadata such as IP address and user agent because every web service needs that to
          respond.
        </p>
        <div className="info-pill-row">
          <Pill>No email</Pill>
          <Pill>No tracking cookies</Pill>
          <Pill>No ads</Pill>
          <Pill>No profile</Pill>
        </div>
      </Section>

      <Section number="02 / STORED" title="Remote storage contains opaque or encrypted material.">
        <ul className="info-list">
          <li>
            <strong>Encrypted blobs</strong> for notes and activity data.
          </li>
          <li>
            <strong>Opaque identifiers</strong> used to find vault records without exposing
            plaintext content.
          </li>
          <li>
            <strong>KDF metadata</strong> like salt and iteration count, which are needed but not
            secret.
          </li>
        </ul>
      </Section>

      <Section number="03 / THIRD PARTIES" title="Storj stores ciphertext; hosting serves the app.">
        <div className="storage-provider-badge" aria-label="Storage provider: Storj">
          <span>Storage provider</span>
          <img src="/storj-logo-full-white.svg" alt="Storj" />
        </div>
        <p>
          Storj and hosting infrastructure may process operational metadata for delivery and
          security. They do not receive your passphrase or decryption key.
        </p>
        <p className="info-note">Last updated: 23 July 2026</p>
      </Section>
    </MarketingPage>
  );
}

export function TermsInfoPage() {
  return (
    <MarketingPage
      eyebrow="Terms of Use"
      title="Short terms for a product that should stay simple."
      lead="No twenty-page legal maze. Just the rules that matter: your data, your responsibility, our boundaries."
    >
      <div className="info-terms-card">
        <span>Human version</span>
        Your data belongs to you. We cannot read it. Do not lose your passphrase.
      </div>

      <Section number="01 / YOUR DATA" title="Anything you store in SEES remains yours.">
        <p>
          We do not own it, sell it, train on it, or profile it. The product is designed so SEES
          does not receive the key required to read vault content.
        </p>
      </Section>

      <Section number="02 / YOUR SIDE" title="Private tools give you control and responsibility.">
        <ul className="info-list">
          <li>Choose a strong passphrase and keep it safe.</li>
          <li>Remember your Vault ID; SEES cannot look it up for you.</li>
          <li>Keep a separate backup of anything irreplaceable.</li>
          <li>Use SEES lawfully where you live.</li>
        </ul>
      </Section>

      <Section number="03 / OUR SIDE" title="No ads, no escrow key, no backdoor.">
        <p>
          SEES should never become surveillance software wearing a privacy costume. If terms change
          materially, the app should surface that clearly.
        </p>
        <p className="info-note">Last updated: 23 July 2026</p>
      </Section>
    </MarketingPage>
  );
}

export const FAQ = [
  [
    "What happens if I forget my passphrase?",
    "Your vault becomes unreadable. There is no reset email and no recovery key.",
  ],
  [
    "Can I back up my notes?",
    "Yes. Vault Settings → Backup lets you export a decrypted JSON file of your notes and import it back into any vault. Since there is no passphrase recovery, this file is the only way to get your notes back if you forget your passphrase — store it somewhere safe.",
  ],
  [
    "Can SEES read my notes?",
    "No. Notes are encrypted locally before storage, and SEES does not receive the key.",
  ],
  [
    "Can I use multiple devices?",
    "Yes. Use the same Vault ID and passphrase, and the browser derives the same key locally.",
  ],
  [
    "Does SEES support 2FA?",
    "Yes. You can enable authenticator-app 2FA from Vault Settings. It adds a second local unlock step after your passphrase, but it is not account recovery and it cannot replace your passphrase.",
  ],
  [
    "Does SEES work offline?",
    "Previously cached encrypted notes can be read after unlock. New writes currently need a connection.",
  ],
  [
    "Has SEES been audited?",
    "Not yet. Treat it as early-stage software until an independent audit is published.",
  ],
  [
    "Will you add email login?",
    "No. Email recovery would create an account and recovery path, which works against the zero-knowledge model.",
  ],
  [
    "Can I share a note with someone else?",
    "Yes. A share link carries its own decryption key in the URL fragment, which never reaches our servers. You can add a password, set an expiry, or revoke the link at any time.",
  ],
  [
    "Is SEES open source?",
    "Yes. The full source is public on GitHub under the MIT license — anyone can audit the code, self-host it, or contribute.",
  ],
];

export function FaqInfoPage() {
  return (
    <MarketingPage
      eyebrow="FAQ"
      title="Straight answers. No soft-focus privacy theater."
      lead="The questions people should ask before trusting an encrypted vault."
    >
      <div className="info-faq-lead">
        <span>Start here</span>
        If the answer sounds strict, that is usually the privacy model doing its job.
      </div>
      <div className="faq-list">
        {FAQ.map(([q, a], index) => (
          <details key={q} className="faq-item">
            <summary className="faq-question">
              <span className="faq-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="faq-question__text">{q}</span>
              <span className="faq-toggle" aria-hidden>
                +
              </span>
            </summary>
            <p className="faq-answer">{a}</p>
          </details>
        ))}
      </div>
      <div className="info-next">
        <span>Need the deeper model?</span>
        <Link to="/security">
          Read security
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </MarketingPage>
  );
}

export function DocsInfoPage() {
  return (
    <MarketingPage
      eyebrow="Documentation"
      title="How to actually use it."
      lead="Everything from creating your first vault to running SEES on your own infrastructure."
    >
      <Section number="01 / CREATE A VAULT" title="No email. Just a Vault ID and a passphrase.">
        <p>
          Choose a Vault ID (a name that locates your vault — not a username or identity) and a
          passphrase. Your browser derives an AES-256 key from the passphrase locally; the
          passphrase itself is never sent anywhere.
        </p>
        <div className="info-pill-row">
          <Pill>No email required</Pill>
          <Pill>No recovery key</Pill>
          <Pill>Works on any device with the same ID + passphrase</Pill>
        </div>
      </Section>

      <Section
        number="02 / UNLOCK & 2FA"
        title="Unlock with your passphrase. Add 2FA if you want a second layer."
      >
        <p>
          Enter your Vault ID and passphrase to unlock. From Vault Settings you can turn on
          authenticator-app 2FA, which adds a second local check after your passphrase. It is a
          local unlock step, not account recovery — losing your passphrase still locks you out.
        </p>
      </Section>

      <Section
        number="03 / SHARING NOTES"
        title="Share a note without handing over your vault key."
      >
        <p>
          Sharing generates a link with its own decryption key stored in the URL fragment, the part
          of a URL browsers never transmit to a server. You can optionally lock a share with its own
          password, set an expiry, or revoke it early from Vault Settings.
        </p>
        <div className="info-pill-row">
          <Pill>Independent share key</Pill>
          <Pill>Optional password</Pill>
          <Pill>Revocable anytime</Pill>
        </div>
      </Section>

      <Section number="04 / SELF-HOSTING" title="The full source is public. Run your own instance.">
        <p>
          SEES is MIT-licensed and needs no database — just an S3-compatible storage bucket (Storj
          or otherwise). The README covers required environment variables, local setup, and
          deployment.
        </p>
        <a
          href="https://github.com/sees-im/sees#self-hosting"
          target="_blank"
          rel="noopener noreferrer"
          className="text-link text-link--dark info-whitepaper-link"
        >
          Read the self-hosting guide on GitHub
          <Github className="size-4" />
        </a>
      </Section>

      <div className="info-next">
        <span>Still have questions?</span>
        <Link to="/faq">
          Read the FAQ
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </MarketingPage>
  );
}

function InfoBox({
  label,
  items,
  muted = false,
}: {
  label: string;
  items: string[];
  muted?: boolean;
}) {
  return (
    <div className={`info-box ${muted ? "is-muted" : ""}`}>
      <span>{label}</span>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
