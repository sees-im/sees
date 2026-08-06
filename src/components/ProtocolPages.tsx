import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MarketingPage, Pill, Section, StatCard } from "@/components/MarketingPage";

type ProtocolSlug = "identity" | "seal" | "distribute";

const protocolDetails = {
  identity: {
    eyebrow: "Protocol / Identity",
    title: "A locator, not a profile.",
    lead: "Your Vault ID exists to find encrypted state. It is deliberately not an account record, recovery address, or identity layer.",
    stats: [
      ["Account email", "None", "No inbox becomes a recovery path"],
      ["Required PII", "0 fields", "No phone, name, or profile"],
      ["Recovery model", "User-held", "Your passphrase is the boundary"],
    ],
    flow: ["Choose Vault ID", "Create passphrase", "Derive local key", "Locate encrypted state"],
    sections: [
      {
        number: "01 / PURPOSE",
        title: "The ID points to a vault without describing the person behind it.",
        body: "A Vault ID is closer to a storage locator than a username. It lets the app find the encrypted material associated with a vault, while avoiding the usual account fields that turn into a profile over time.",
        pills: ["No email login", "No account profile", "No recovery address"],
      },
      {
        number: "02 / BOUNDARY",
        title: "Possession of the ID alone does not unlock anything.",
        body: "The Vault ID is not secret enough to treat as a password. Unlocking still requires the passphrase, which is stretched inside the browser before any vault material can be decrypted.",
        pills: ["ID is not a key", "Passphrase required", "Browser-side unlock"],
      },
      {
        number: "03 / FAILURE MODE",
        title: "No account also means no reset button.",
        body: "SEES cannot verify an identity it never collected. That is intentional: account recovery would create a privileged path around encryption, so the product makes the trade-off explicit.",
        pills: ["No reset email", "No support override", "No escrow key"],
      },
    ],
    next: "seal",
  },
  seal: {
    eyebrow: "Protocol / Seal",
    title: "Encrypt before the network.",
    lead: "The sensitive step happens locally. Your browser turns the passphrase into an encryption key and seals vault content before storage ever sees it.",
    stats: [
      ["Cipher", "AES-256-GCM", "Confidentiality plus tamper detection"],
      ["KDF", "PBKDF2", "SHA-256, 250,000 iterations"],
      ["Server plaintext", "0 bytes", "The key never leaves the browser"],
    ],
    flow: ["Passphrase", "PBKDF2-SHA256", "AES-256 key", "AES-GCM seal", "Ciphertext"],
    sections: [
      {
        number: "01 / DERIVE",
        title: "The passphrase is stretched locally into a vault key.",
        body: "SEES uses a per-vault salt and PBKDF2-SHA256 to make brute-force attempts more expensive. The derived AES key is kept in browser memory while the vault is unlocked.",
        pills: ["Per-vault salt", "250k iterations", "Memory only"],
      },
      {
        number: "02 / SEAL",
        title: "Every write is authenticated ciphertext.",
        body: "AES-256-GCM protects both confidentiality and integrity. If encrypted data is modified in storage or transit, decryption fails instead of returning silently corrupted content.",
        pills: ["Authenticated encryption", "Tamper detection", "Unique nonce per seal"],
      },
      {
        number: "03 / LIMIT",
        title: "Strong cryptography still depends on the device you use.",
        body: "Local encryption protects against server-side exposure, but it cannot save a compromised browser, malicious extension, or weak passphrase. The security model is powerful because it is honest about that boundary.",
        pills: ["Device trust matters", "Use strong passphrases", "No magic claims"],
      },
    ],
    next: "distribute",
  },
  distribute: {
    eyebrow: "Protocol / Distribute",
    title: "Store ciphertext everywhere. Trust nowhere.",
    lead: "Remote infrastructure only receives encrypted material. Distribution improves durability without asking storage nodes, hosts, or operators to become trusted readers.",
    stats: [
      ["Stored material", "Ciphertext", "Fragments are unreadable without the key"],
      ["Storage layer", "storj-logo", "Distributed object storage"],
      ["Readable by SEES", "Never", "No server-held decryption key"],
    ],
    flow: [
      "Sealed payload",
      "Upload object",
      "Distributed storage",
      "Fetch ciphertext",
      "Decrypt locally",
    ],
    sections: [
      {
        number: "01 / UPLOAD",
        title: "Only sealed vault material crosses the boundary.",
        body: "The browser sends encrypted blobs and required metadata, not plaintext notes. Infrastructure can route and store the object, but it should not be able to understand what the object contains.",
        pills: ["Ciphertext only", "No plaintext transport", "Opaque objects"],
      },
      {
        number: "02 / DURABILITY",
        title: "Distribution is for resilience, not permission.",
        body: "Storj handles distributed storage while SEES keeps the trust boundary at the client. Nodes can hold pieces of data, but the decryption capability remains with the user.",
        pills: ["Distributed storage", "Client-held key", "No readable nodes"],
      },
      {
        number: "03 / RETURN",
        title: "Reads complete the same loop in reverse.",
        body: "When you unlock a vault, the app fetches ciphertext, derives the same local key from your passphrase, and decrypts in the browser. The server remains a courier, not a reader.",
        pills: ["Fetch encrypted", "Decrypt local", "Server stays blind"],
      },
    ],
    next: "identity",
  },
} satisfies Record<
  ProtocolSlug,
  {
    eyebrow: string;
    title: string;
    lead: string;
    stats: [string, string, string][];
    flow: string[];
    sections: { number: string; title: string; body: string; pills: string[] }[];
    next: ProtocolSlug;
  }
>;

const nextLabels: Record<ProtocolSlug, string> = {
  identity: "Identity",
  seal: "Seal",
  distribute: "Distribute",
};

export function ProtocolDetailPage({ slug }: { slug: ProtocolSlug }) {
  const detail = protocolDetails[slug];
  const nextSlug = detail.next;

  return (
    <MarketingPage eyebrow={detail.eyebrow} title={detail.title} lead={detail.lead}>
      <div className="protocol-detail">
        <div className="info-hero-grid protocol-detail__stats">
          {detail.stats.map(([label, value, hint]) =>
            value === "storj-logo" ? (
              <div className="marketing-stat marketing-stat--logo" key={label}>
                <div className="marketing-stat__label">{label}</div>
                <img src="/storj-logo-full-white.svg" alt="Storj" />
                <div className="marketing-stat__hint">{hint}</div>
              </div>
            ) : (
              <StatCard key={label} label={label} value={value} hint={hint} />
            ),
          )}
        </div>

        <div className="info-flow protocol-detail__flow" aria-label={`${detail.title} flow`}>
          {detail.flow.map((item, index) => (
            <div className="info-flow__step" key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item}
            </div>
          ))}
        </div>

        <div className="protocol-detail__statement">
          <span>Design rule</span>
          Minimize what infrastructure can know. Make the unavoidable trade-offs visible.
        </div>

        {detail.sections.map((section) => (
          <Section key={section.number} number={section.number} title={section.title}>
            <p>{section.body}</p>
            <div className="info-pill-row">
              {section.pills.map((pill) => (
                <Pill key={pill}>{pill}</Pill>
              ))}
            </div>
          </Section>
        ))}

        <div className="info-next protocol-detail__next">
          <span>Continue the protocol</span>
          <Link to={`/protocol/${nextSlug}`}>
            {nextLabels[nextSlug]}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="info-next protocol-detail__next">
          <span>Need the complete threat model?</span>
          <Link to="/security">
            Read security
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </MarketingPage>
  );
}
