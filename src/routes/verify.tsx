import { createFileRoute } from "@tanstack/react-router";
import { VerifyBuild } from "@/components/VerifyBuild";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify the build — SEES" },
      {
        name: "description",
        content:
          "Hash the SEES client bundle in your own browser and compare it against the published SHA-256 manifest.",
      },
      { property: "og:title", content: "Verify the build — SEES" },
      {
        property: "og:description",
        content:
          "Every client asset SEES ships is published with its SHA-256. Re-hash them in your browser and check.",
      },
      { property: "og:url", content: "https://www.sees.im/verify" },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/verify" }],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  return <VerifyBuild />;
}
