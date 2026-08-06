import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Github } from "lucide-react";
import { MarketingPage, Pill, Section } from "@/components/MarketingPage";
import { BLOG_POSTS_BY_DATE, formatPostDate, type BlogPost } from "@/lib/blog";

// Prose for each post. Kept as components rather than markdown so posts reuse
// the same Section/Pill vocabulary as the rest of the marketing pages and stay
// type-checked against it.

export function BlogIndexPage() {
  return (
    <MarketingPage
      eyebrow="Writing"
      title="Notes from inside the vault."
      lead="How SEES is built, and the trade-offs we chose on purpose. No product announcements."
    >
      <div className="blog-list">
        {BLOG_POSTS_BY_DATE.map((post) => (
          <Link key={post.slug} to="/blog/$slug" params={{ slug: post.slug }} className="blog-card">
            <div className="blog-card__meta">
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
              <span aria-hidden>·</span>
              <span>{post.readingMinutes} min read</span>
            </div>
            <h2 className="blog-card__title">{post.title}</h2>
            <p className="blog-card__excerpt">{post.description}</p>
            <div className="blog-card__tags">
              {post.tags.map((tag) => (
                <Pill key={tag}>{tag}</Pill>
              ))}
            </div>
            <span className="blog-card__more">
              Read
              <ArrowUpRight className="size-4" />
            </span>
          </Link>
        ))}
      </div>
    </MarketingPage>
  );
}

export function BlogPostPage({ post }: { post: BlogPost }) {
  return (
    <MarketingPage
      eyebrow={`Writing · ${formatPostDate(post.date)}`}
      title={post.title}
      lead={post.description}
    >
      <PostBody slug={post.slug} />

      <div className="info-next">
        <span>More writing</span>
        <Link to="/blog">
          Back to all posts
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </MarketingPage>
  );
}

function PostBody({ slug }: { slug: string }) {
  if (slug === "no-recovery") return <NoRecoveryPost />;
  if (slug === "passphrase-to-key") return <PassphraseToKeyPost />;
  if (slug === "where-ciphertext-lives") return <WhereCiphertextLivesPost />;
  if (slug === "what-sees-cannot-protect") return <CannotProtectPost />;
  if (slug === "how-share-links-work") return <ShareLinksPost />;
  if (slug === "two-factor-not-a-spare-key") return <TwoFactorPost />;
  if (slug === "vault-id-is-a-locator") return <VaultIdPost />;
  if (slug === "zero-knowledge-vs-encrypted-at-rest") return <ZeroKnowledgePost />;
  if (slug === "bot-protection-without-tracking") return <BotProtectionPost />;
  if (slug === "self-hosting") return <SelfHostingPost />;
  return null;
}

function BotProtectionPost() {
  return (
    <>
      <Section number="01 / THE PROBLEM" title="Open endpoints get abused.">
        <p>
          Vault creation and the contact form are unauthenticated by design — there are no accounts
          to rate-limit against. That openness is the point, and it is also exactly what automated
          abuse looks for.
        </p>
      </Section>

      <Section
        number="02 / THE USUAL COST"
        title="Most bot defences are surveillance with a job title."
      >
        <p>
          The standard answer is a challenge that profiles the visitor: cookies, device
          fingerprinting, behavioural scoring across sites. It works, and it quietly undoes the
          reason someone chose a privacy tool in the first place.
        </p>
      </Section>

      <Section number="03 / WHAT WE USE" title="Cloudflare Turnstile, verified server-side.">
        <p>
          Turnstile issues a token that our server checks against Cloudflare's verification endpoint
          before the request is accepted. It is designed to run without tracking cookies or
          cross-site behavioural profiles, which is why it was the acceptable option here.
        </p>
        <div className="info-pill-row">
          <Pill>No tracking cookies</Pill>
          <Pill>Server-side verification</Pill>
          <Pill>No vault data involved</Pill>
        </div>
      </Section>

      <Section number="04 / THE BOUNDARY" title="It never touches your notes.">
        <p>
          Worth stating plainly: the check happens before anything is created, and it sits entirely
          outside the encryption path. No note content, no passphrase, and no derived key is
          involved in it — a bot check cannot see what even we cannot see.
        </p>
      </Section>
    </>
  );
}

function NoRecoveryPost() {
  return (
    <>
      <Section number="01 / THE TRADE-OFF" title="A reset link is a backdoor with good manners.">
        <p>
          Every service that can email you a recovery link can also read your data, or be compelled
          to. That is not a criticism of how those services are run — it is a description of what
          the feature requires. To restore access to data you can no longer unlock, someone else has
          to be holding a key.
        </p>
        <p>
          SEES does not hold one. Your passphrase is turned into a key inside your browser and is
          never transmitted, so there is nothing on our side to reset from.
        </p>
      </Section>

      <Section number="02 / WHAT IT COSTS" title="Forget your passphrase and the vault is gone.">
        <p>
          We would rather state this plainly than bury it. There is no reset email, no recovery key,
          no support process that ends with you getting back in. If the passphrase is lost, the
          ciphertext stays ciphertext.
        </p>
        <div className="info-pill-row">
          <Pill>No reset email</Pill>
          <Pill>No recovery key</Pill>
          <Pill>No support override</Pill>
        </div>
      </Section>

      <Section
        number="03 / WHAT 2FA IS AND ISN'T"
        title="Two-factor is a second lock, not a spare key."
      >
        <p>
          You can enable authenticator-app 2FA from Vault Settings. It adds a second local check
          after your passphrase — it does not recover anything. Losing the passphrase still locks
          you out, with or without it.
        </p>
      </Section>

      <Section number="04 / WHO THIS IS FOR" title="Choose the guarantee you actually want.">
        <p>
          If the worst outcome you can imagine is losing your own notes, a service with account
          recovery is the reasonable choice, and you should use one. If the worst outcome is someone
          else reading them, the absence of recovery is the entire point.
        </p>
        <Link to="/security" className="text-link text-link--dark info-whitepaper-link">
          Read the security model
          <ArrowUpRight className="size-4" />
        </Link>
      </Section>
    </>
  );
}

function PassphraseToKeyPost() {
  return (
    <>
      <Section number="01 / DERIVATION" title="PBKDF2-SHA256, 250,000 iterations.">
        <p>
          Your passphrase is not a key — it is a short, guessable string. Turning it into one means
          deliberately slowing the conversion down, so that guessing costs an attacker real time.
          SEES runs PBKDF2 with SHA-256 over 250,000 iterations against a per-vault salt, using the
          browser's own Web Crypto implementation.
        </p>
        <div className="info-pill-row">
          <Pill>PBKDF2-SHA256</Pill>
          <Pill>250,000 iterations</Pill>
          <Pill>Per-vault salt</Pill>
        </div>
      </Section>

      <Section number="02 / THE KEY" title="AES-256-GCM, derived in your browser.">
        <p>
          The output is a 256-bit AES-GCM key. GCM is authenticated encryption: it does not only
          hide the contents, it detects tampering, so modified ciphertext fails to decrypt rather
          than quietly returning wrong data. Every write gets a fresh random IV.
        </p>
        <p>
          The key exists in browser memory for as long as your vault is unlocked. It is never
          serialized to storage and never sent over the network.
        </p>
      </Section>

      <Section number="03 / WHAT LEAVES YOUR DEVICE" title="Ciphertext, and not much else.">
        <p>
          What crosses the network is the encrypted blob and the IV needed to decrypt it. Your
          passphrase does not. The key derived from it does not. That is what makes the
          zero-knowledge claim checkable rather than promotional — you can read the derivation in{" "}
          <code>src/lib/crypto.ts</code> and confirm it yourself.
        </p>
        <a
          href="https://github.com/sees-im/sees/blob/main/src/lib/crypto.ts"
          target="_blank"
          rel="noopener noreferrer"
          className="text-link text-link--dark info-whitepaper-link"
        >
          Read crypto.ts on GitHub
          <Github className="size-4" />
        </a>
      </Section>

      <Section
        number="04 / SHARE LINKS"
        title="The key travels in the part of the URL browsers never send."
      >
        <p>
          Sharing a note generates its own key rather than exposing your vault key, and puts it in
          the URL fragment — the portion after <code>#</code>, which browsers do not transmit to the
          server. A share can carry its own password, an expiry, and can be revoked early.
        </p>
      </Section>
    </>
  );
}

function WhereCiphertextLivesPost() {
  return (
    <>
      <Section number="01 / NO DATABASE" title="There is no table with your name in it.">
        <p>
          SEES has no user database, because it has no users in the usual sense — no email, no
          account record, no profile. A Vault ID is a locator for an encrypted object, not an
          identity. There is nothing to join it against.
        </p>
      </Section>

      <Section number="02 / STORAGE" title="Sealed blobs on Storj.">
        <p>
          Encrypted blobs are written to Storj, an S3-compatible distributed storage network, where
          they are split and spread across independent nodes. Those nodes hold fragments of data
          they have no key for. SEES speaks to storage the same way any S3 client would, which is
          also why self-hosting works against any S3-compatible bucket.
        </p>
        <div className="info-pill-row">
          <Pill>S3-compatible</Pill>
          <Pill>Distributed fragments</Pill>
          <Pill>No database</Pill>
        </div>
      </Section>

      <Section number="03 / THE HONEST PART" title="What an operator can still see.">
        <p>
          Encryption hides contents, not the existence of objects. Whoever runs the storage can see
          that a vault exists, roughly how large it is, and when it was last written. That is
          metadata, and we would rather name it than let "zero-knowledge" imply it away.
        </p>
        <p>
          What they cannot do is read it. Decryption requires a key derived from a passphrase that
          never left your device.
        </p>
      </Section>

      <Section number="04 / RUN IT YOURSELF" title="MIT-licensed, no database to provision.">
        <p>
          If you would rather not take our word for any of this, the full source is public and the
          deployment needs nothing but an S3-compatible bucket.
        </p>
        <a
          href="https://github.com/sees-im/sees#self-hosting"
          target="_blank"
          rel="noopener noreferrer"
          className="text-link text-link--dark info-whitepaper-link"
        >
          Read the self-hosting guide
          <Github className="size-4" />
        </a>
      </Section>
    </>
  );
}

function CannotProtectPost() {
  return (
    <>
      <Section
        number="01 / THE LIMIT"
        title="Encryption protects data at rest, not a compromised device."
      >
        <p>
          SEES encrypts in your browser, which means the plaintext exists in your browser. Anything
          with control of that environment sees what you see. Malware, a keylogger, or a hostile
          browser extension reads your notes after you unlock them, and no amount of AES changes
          that.
        </p>
        <div className="info-pill-row">
          <Pill>Device malware</Pill>
          <Pill>Browser extensions</Pill>
          <Pill>Weak passphrases</Pill>
        </div>
      </Section>

      <Section number="02 / THE PASSPHRASE" title="A short passphrase is a short passphrase.">
        <p>
          250,000 PBKDF2 iterations make guessing expensive, not impossible. They buy time
          proportional to how much entropy you supplied. A common word with a number after it is
          still weak; the key derivation cannot add entropy that was never there.
        </p>
      </Section>

      <Section number="03 / THE HARDEST ONE" title="You are trusting the code you were served.">
        <p>
          This is the honest structural limit of any browser-delivered encryption, SEES included.
          Each visit downloads JavaScript, and a compromised host could serve a version that behaves
          differently. Zero-knowledge protects you from a server that reads your storage; it does
          not by itself protect you from a server that changes your client.
        </p>
        <p>
          Our answers are partial and we will name them as partial: the source is public and
          MIT-licensed so the code can be audited, and self-hosting removes us from the delivery
          path entirely. Neither is the same as a formal guarantee.
        </p>
      </Section>

      <Section number="04 / NOT YET AUDITED" title="No independent audit has been published.">
        <p>
          We would rather say this on our own blog than have it discovered. SEES has not been
          through an independent security audit. Treat it as early-stage software, weigh it
          accordingly, and read the code if the stakes are high for you.
        </p>
        <Link to="/security" className="text-link text-link--dark info-whitepaper-link">
          Read the full threat model
          <ArrowUpRight className="size-4" />
        </Link>
      </Section>
    </>
  );
}

function ShareLinksPost() {
  return (
    <>
      <Section number="01 / THE FRAGMENT" title="Everything after the # stays in the browser.">
        <p>
          A share link carries its payload in the URL fragment. Browsers do not transmit the
          fragment to the server, which makes it the one place in a URL where a key can travel
          without being logged by every hop in between. The server hosting the link never receives
          the material needed to read it.
        </p>
      </Section>

      <Section number="02 / TWO MODES" title="Open links carry a key. Locked links carry a salt.">
        <p>
          An open share embeds a freshly generated 32-byte AES-GCM key in the fragment — anyone with
          the link can read the note. A locked share embeds only a 16-byte salt; the key is derived
          from a password you give the recipient separately, again with PBKDF2-SHA256 at 250,000
          iterations. The link alone is useless without it.
        </p>
        <div className="info-pill-row">
          <Pill>Open: random key</Pill>
          <Pill>Locked: password-derived</Pill>
          <Pill>Independent of your vault key</Pill>
        </div>
      </Section>

      <Section number="03 / THE BLOB" title="One base64url string, not a query soup.">
        <p>
          The fragment is a single encoded blob with a fixed layout: a version byte, a flags byte
          recording mode and compression, a 12-byte IV, then either the raw key or the salt,
          followed by ciphertext. Packing it this way keeps links short and leaves no readable
          parameters to inspect.
        </p>
      </Section>

      <Section number="04 / CONTROL" title="Expiry and revocation stay with you.">
        <p>
          Shares can carry an expiry and be revoked early from Vault Settings. Critically, a share
          never exposes your vault key — revoking one has no effect on your vault, and a leaked
          share link cannot be walked back into it.
        </p>
      </Section>
    </>
  );
}

function TwoFactorPost() {
  return (
    <>
      <Section number="01 / STANDARD TOTP" title="Six digits, thirty seconds, any authenticator.">
        <p>
          SEES implements ordinary time-based one-time passwords: six digits on a thirty-second
          step, the same scheme your authenticator app already speaks. Nothing proprietary, no SMS,
          no phone number, no push service in the middle.
        </p>
        <div className="info-pill-row">
          <Pill>6 digits</Pill>
          <Pill>30-second step</Pill>
          <Pill>Any TOTP app</Pill>
        </div>
      </Section>

      <Section number="02 / WHAT IT GUARDS" title="It gates unlocking, not decryption.">
        <p>
          This is the part worth being precise about. In most services, 2FA guards an account, and
          the provider can decrypt your data once you are through. Here there is no account to guard
          and no provider-side decryption to reach. 2FA adds a second local check in front of the
          unlock step.
        </p>
      </Section>

      <Section number="03 / WHAT IT ISN'T" title="Turning it on does not create a way back in.">
        <p>
          Some services treat a second factor as a recovery path. SEES cannot, because the
          passphrase is the only input to the key. Enabling 2FA does not weaken that, and losing
          your passphrase still means losing the vault — with 2FA on or off.
        </p>
        <Link
          to="/blog/$slug"
          params={{ slug: "no-recovery" }}
          className="text-link text-link--dark info-whitepaper-link"
        >
          Why there is no recovery at all
          <ArrowUpRight className="size-4" />
        </Link>
      </Section>
    </>
  );
}

function VaultIdPost() {
  return (
    <>
      <Section
        number="01 / A NAME THAT POINTS"
        title="It addresses an object. It does not describe a person."
      >
        <p>
          A Vault ID is how SEES finds your encrypted blob. That is the whole job. It is not a
          username, because there is no user record behind it; not an account, because there is
          nothing to sign into; and not an identity, because nothing personal is attached to it.
        </p>
      </Section>

      <Section number="02 / NOTHING TO CORRELATE" title="No email means no join key.">
        <p>
          Most privacy leaks are not decryption — they are correlation. An email address links an
          account to a breach dump, a mailing list, a support ticket. SEES never collects one, so
          there is no field to match your vault against anything else.
        </p>
        <div className="info-pill-row">
          <Pill>No email</Pill>
          <Pill>No phone number</Pill>
          <Pill>No profile</Pill>
        </div>
      </Section>

      <Section number="03 / THE IMPLICATION" title="Pick one that isn't already your handle.">
        <p>
          Because a Vault ID is a public locator, reusing the handle you post under elsewhere hands
          back exactly the correlation the design avoids. It costs nothing to pick something
          unrelated, and it is the one privacy decision here that is entirely yours to make.
        </p>
      </Section>
    </>
  );
}

function ZeroKnowledgePost() {
  return (
    <>
      <Section number="01 / ENCRYPTED AT REST" title="The provider holds the key.">
        <p>
          "Encrypted at rest" means data is encrypted on the provider's disks. It is worth having —
          it defends against stolen drives and some classes of breach. But the provider holds the
          key, which means the provider can decrypt. So can anyone who compels or compromises them.
        </p>
      </Section>

      <Section number="02 / ZERO-KNOWLEDGE" title="The key never reaches the provider.">
        <p>
          Zero-knowledge means encryption happens before transmission, with a key the service never
          receives. The provider stores bytes it cannot interpret. The distinction is not one of
          degree — it changes who is capable of reading your data, not merely who is permitted to.
        </p>
        <div className="info-pill-row">
          <Pill>At rest: provider can decrypt</Pill>
          <Pill>Zero-knowledge: provider cannot</Pill>
        </div>
      </Section>

      <Section number="03 / THE TELL" title="Ask what happens when you forget the password.">
        <p>
          It is the fastest test there is. If a service can restore your access after you forget
          your password, it can read your data — those are the same capability described two ways.
          If it cannot, it is telling you something real about where the key lives.
        </p>
        <p>SEES cannot. That is not a missing feature; it is the property being claimed.</p>
      </Section>
    </>
  );
}

function SelfHostingPost() {
  return (
    <>
      <Section number="01 / WHY IT MATTERS" title="Verifiability beats assurance.">
        <p>
          Every privacy product says it cannot read your data. The difference between a claim and a
          property is whether you can check. SEES is MIT-licensed and the full source is public, so
          the derivation, the storage path, and the share format are all inspectable rather than
          asserted.
        </p>
      </Section>

      <Section
        number="02 / WHAT IT TAKES"
        title="An S3-compatible bucket. That is the dependency list."
      >
        <p>
          There is no database to provision, no migration to run, and no account system to configure
          — consequences of a design that stores opaque blobs and keeps no user records. Point it at
          Storj or any S3-compatible bucket, set the environment variables, deploy.
        </p>
        <div className="info-pill-row">
          <Pill>MIT licensed</Pill>
          <Pill>No database</Pill>
          <Pill>Any S3-compatible storage</Pill>
        </div>
      </Section>

      <Section number="03 / WHAT IT CLOSES" title="It removes us from the delivery path.">
        <p>
          Running your own instance addresses the sharpest limitation of browser-delivered
          encryption: that you are trusting whoever serves the JavaScript. Self-host and that party
          is you.
        </p>
        <a
          href="https://github.com/sees-im/sees#self-hosting"
          target="_blank"
          rel="noopener noreferrer"
          className="text-link text-link--dark info-whitepaper-link"
        >
          Read the self-hosting guide
          <Github className="size-4" />
        </a>
      </Section>
    </>
  );
}
