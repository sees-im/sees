import { createFileRoute } from "@tanstack/react-router";
import { TermsInfoPage } from "@/components/InfoPages";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — SEES" },
      {
        name: "description",
        content:
          "SEES Terms of Use, written for humans. Plain language. User-first. No surprises.",
      },
      { property: "og:title", content: "Terms — SEES" },
      {
        property: "og:description",
        content: "Plain-language terms that prioritize user rights, privacy, and ownership.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <TermsInfoPage />;
}
