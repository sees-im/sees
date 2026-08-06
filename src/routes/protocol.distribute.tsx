import { createFileRoute } from "@tanstack/react-router";
import { ProtocolDetailPage } from "@/components/ProtocolPages";

export const Route = createFileRoute("/protocol/distribute")({
  head: () => ({
    meta: [
      { title: "Distribute Protocol - SEES" },
      {
        name: "description",
        content:
          "How SEES stores unreadable ciphertext across distributed storage while keeping decryption local to the user.",
      },
      { property: "og:title", content: "Distribute Protocol - SEES" },
      {
        property: "og:description",
        content:
          "A professional breakdown of SEES distributed storage model: store everywhere, trust nowhere.",
      },
      { property: "og:url", content: "https://www.sees.im/protocol/distribute" },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/protocol/distribute" }],
  }),
  component: DistributeProtocolPage,
});

function DistributeProtocolPage() {
  return <ProtocolDetailPage slug="distribute" />;
}
