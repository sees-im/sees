import { createFileRoute } from "@tanstack/react-router";
import { PrivacyInfoPage } from "@/components/InfoPages";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — SEES" },
      {
        name: "description",
        content:
          "What SEES stores, what the service can observe, and how client-side encryption protects vault content.",
      },
      { property: "og:title", content: "Privacy — SEES" },
      {
        property: "og:description",
        content: "A direct account of SEES encrypted data, connection metadata, and local storage.",
      },
      { property: "og:url", content: "https://www.sees.im/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <PrivacyInfoPage />;
}
