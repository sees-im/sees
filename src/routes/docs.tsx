import { createFileRoute } from "@tanstack/react-router";
import { DocsInfoPage } from "@/components/InfoPages";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — SEES" },
      {
        name: "description",
        content: "How to create a vault, unlock with 2FA, share notes, and self-host SEES.",
      },
      { property: "og:title", content: "Documentation — SEES" },
      {
        property: "og:description",
        content: "How to create a vault, unlock with 2FA, share notes, and self-host SEES.",
      },
      { property: "og:url", content: "https://www.sees.im/docs" },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/docs" }],
  }),
  component: DocsPage,
});

function DocsPage() {
  return <DocsInfoPage />;
}
