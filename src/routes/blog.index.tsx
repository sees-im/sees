import { createFileRoute } from "@tanstack/react-router";
import { BlogIndexPage } from "@/components/BlogPosts";
import { BLOG_POSTS_BY_DATE } from "@/lib/blog";

const TITLE = "Writing — SEES";
const DESCRIPTION =
  "How SEES is built and the trade-offs chosen on purpose: no recovery, local key derivation, and distributed encrypted storage.";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://www.sees.im/blog" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/blog" }],
    scripts: [
      {
        type: "application/ld+json",
        // An ItemList of the posts, so the index has something to say to
        // crawlers beyond the individual articles.
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          "@id": "https://www.sees.im/blog#blog",
          name: "SEES — Writing",
          description: DESCRIPTION,
          url: "https://www.sees.im/blog",
          publisher: { "@id": "https://www.sees.im/#organization" },
          blogPost: BLOG_POSTS_BY_DATE.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            url: `https://www.sees.im/blog/${post.slug}`,
          })),
        }),
      },
    ],
  }),
  component: BlogIndexPage,
});
