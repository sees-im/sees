import { createFileRoute } from "@tanstack/react-router";
import { FAQ, FaqInfoPage } from "@/components/InfoPages";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — SEES" },
      {
        name: "description",
        content:
          "Frequently asked questions about SEES: passphrases, recovery, sharing, and the zero-knowledge model.",
      },
      { property: "og:title", content: "FAQ — SEES" },
      {
        property: "og:description",
        content: "Honest answers about how SEES works, what it can do, and what it can't.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(([question, answer]) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return <FaqInfoPage />;
}
