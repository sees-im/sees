import { createFileRoute } from "@tanstack/react-router";
import { ProtocolDetailPage } from "@/components/ProtocolPages";

export const Route = createFileRoute("/protocol/seal")({
  head: () => ({
    meta: [
      { title: "Seal Protocol - SEES" },
      {
        name: "description",
        content:
          "How SEES derives encryption keys locally and seals vault content in the browser before network transport.",
      },
      { property: "og:title", content: "Seal Protocol - SEES" },
      {
        property: "og:description",
        content:
          "A professional breakdown of SEES local encryption flow: encrypt here, then transmit.",
      },
      { property: "og:url", content: "https://www.sees.im/protocol/seal" },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/protocol/seal" }],
  }),
  component: SealProtocolPage,
});

function SealProtocolPage() {
  return <ProtocolDetailPage slug="seal" />;
}
