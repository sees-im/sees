// Blog post registry. Metadata lives here (plain data, no JSX) so routes,
// the index listing, structured data, and the sitemap can all read from one
// source; the prose for each post lives in components/BlogPosts.tsx.
//
// To add a post: add an entry here, add a matching case in BlogPosts.tsx, and
// add its URL to public/sitemap.xml.

export interface BlogPost {
  slug: string;
  title: string;
  /** Also used as the meta description and the listing excerpt. */
  description: string;
  /** ISO date — drives ordering and the `datePublished` in structured data. */
  date: string;
  readingMinutes: number;
  tags: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "no-recovery",
    title: "Why SEES has no password recovery",
    description:
      "Every reset link is a backdoor with good manners. Here is why SEES refuses to build one, and what that costs you.",
    date: "2026-08-06",
    readingMinutes: 4,
    tags: ["Design", "Threat model"],
  },
  {
    slug: "passphrase-to-key",
    title: "How your passphrase becomes a key",
    description:
      "PBKDF2-SHA256 at 250,000 iterations, an AES-256-GCM key, and why none of it ever leaves your browser.",
    date: "2026-08-05",
    readingMinutes: 5,
    tags: ["Cryptography"],
  },
  {
    slug: "where-ciphertext-lives",
    title: "Where your ciphertext actually lives",
    description:
      "SEES stores sealed blobs on Storj and holds no database. What that means for what an operator can see.",
    date: "2026-08-04",
    readingMinutes: 4,
    tags: ["Architecture", "Storage"],
  },
  {
    slug: "what-sees-cannot-protect",
    title: "What SEES cannot protect you from",
    description:
      "Encryption is not a force field. The attacks that still work, stated plainly, including the one we have not closed yet.",
    date: "2026-08-03",
    readingMinutes: 5,
    tags: ["Threat model", "Honesty"],
  },
  {
    slug: "how-share-links-work",
    title: "How share links carry a key without leaking it",
    description:
      "Two modes, one base64url blob, and the part of a URL that browsers never send to a server.",
    date: "2026-08-02",
    readingMinutes: 5,
    tags: ["Cryptography", "Sharing"],
  },
  {
    slug: "two-factor-not-a-spare-key",
    title: "Two-factor that isn't a spare key",
    description:
      "Standard TOTP, six digits, thirty seconds — and why in a zero-knowledge vault it protects unlocking, not recovery.",
    date: "2026-08-01",
    readingMinutes: 3,
    tags: ["Design", "2FA"],
  },
  {
    slug: "vault-id-is-a-locator",
    title: "A Vault ID is a locator, not a username",
    description:
      "No email, no account record, no profile. What a Vault ID actually is and what it deliberately isn't.",
    date: "2026-07-31",
    readingMinutes: 3,
    tags: ["Design", "Privacy"],
  },
  {
    slug: "zero-knowledge-vs-encrypted-at-rest",
    title: "Zero-knowledge vs encrypted at rest",
    description:
      "Both phrases appear on security pages. Only one of them means the provider cannot read your data.",
    date: "2026-07-30",
    readingMinutes: 4,
    tags: ["Concepts"],
  },
  {
    slug: "bot-protection-without-tracking",
    title: "Blocking bots without tracking people",
    description:
      "Abuse protection usually arrives bundled with surveillance. Why SEES uses Turnstile and what it does not collect.",
    date: "2026-07-28",
    readingMinutes: 3,
    tags: ["Privacy", "Infrastructure"],
  },
  {
    slug: "self-hosting",
    title: "Running SEES yourself",
    description:
      "MIT-licensed, no database, and nothing to provision but an S3-compatible bucket. Why that matters more than a promise.",
    date: "2026-07-29",
    readingMinutes: 3,
    tags: ["Self-hosting", "Open source"],
  },
];

/** Newest first — the order the listing and sitemap should use. */
export const BLOG_POSTS_BY_DATE = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));

export function findPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function formatPostDate(iso: string): string {
  // Fixed locale/timezone so server and client render identical text —
  // otherwise the date hydrates differently and React warns.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
