import { createFileRoute } from "@tanstack/react-router";
import { ProtocolDetailPage } from "@/components/ProtocolPages";

export const Route = createFileRoute("/protocol/identity")({
  head: () => ({
    meta: [
      { title: "Identity Protocol - SEES" },
      {
        name: "description",
        content:
          "How SEES uses a Vault ID as a locator without creating an account profile, recovery address, or identity layer.",
      },
      { property: "og:title", content: "Identity Protocol - SEES" },
      {
        property: "og:description",
        content: "A professional breakdown of SEES identity design: claim a name, reveal nothing.",
      },
      { property: "og:url", content: "https://www.sees.im/protocol/identity" },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/protocol/identity" }],
  }),
  component: IdentityProtocolPage,
});

function IdentityProtocolPage() {
  return <ProtocolDetailPage slug="identity" />;
}
