import { createFileRoute, notFound } from "@tanstack/react-router";
import { BlogPostPage } from "@/components/BlogPosts";
import { findPost } from "@/lib/blog";

export const Route = createFileRoute("/blog/$slug")({
  // Resolve the post before render so an unknown slug 404s instead of
  // rendering an empty article shell with a bogus canonical URL.
  loader: ({ params }) => {
    const post = findPost(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData: post }) => {
    if (!post) return {};
    const url = `https://www.sees.im/blog/${post.slug}`;
    const title = `${post.title} — SEES`;
    return {
      meta: [
        { title },
        { name: "description", content: post.description },
        { property: "og:title", content: title },
        { property: "og:description", content: post.description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: post.date },
        ...post.tags.map((tag) => ({ property: "article:tag", content: tag })),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "@id": `${url}#post`,
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            dateModified: post.date,
            url,
            mainEntityOfPage: url,
            keywords: post.tags.join(", "),
            author: { "@id": "https://www.sees.im/#organization" },
            publisher: { "@id": "https://www.sees.im/#organization" },
            isPartOf: { "@id": "https://www.sees.im/blog#blog" },
          }),
        },
      ],
    };
  },
  component: BlogPostRoute,
});

function BlogPostRoute() {
  return <BlogPostPage post={Route.useLoaderData()} />;
}
