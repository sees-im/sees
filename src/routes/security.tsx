import { createFileRoute } from "@tanstack/react-router";
import { SecurityInfoPage } from "@/components/InfoPages";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — SEES" },
      {
        name: "description",
        content:
          "SEES security architecture: browser-side AES-256-GCM, PBKDF2-SHA256, zero-knowledge storage, and threat model.",
      },
      { property: "og:title", content: "Security — SEES" },
      {
        property: "og:description",
        content: "Client-side encryption, local key derivation, and a clear threat model for SEES.",
      },
      { property: "og:url", content: "https://www.sees.im/security" },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/security" }],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return <SecurityInfoPage />;
}
