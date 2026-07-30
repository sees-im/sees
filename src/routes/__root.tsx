import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { VaultProvider } from "@/lib/vault-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SEES — Secure End-to-End State" },
      { name: "description", content: "SEES is a zero-knowledge encrypted vault for files and notes. No email, no recovery, no backdoors. Your passphrase never leaves your device." },
      { name: "author", content: "SEES" },
      { property: "og:title", content: "SEES — Secure End-to-End State" },
      { property: "og:description", content: "SEES is a zero-knowledge encrypted vault for files and notes. No email, no recovery, no backdoors. Your passphrase never leaves your device." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.sees.im/" },
      { property: "og:site_name", content: "SEES" },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: "https://www.sees.im/icon-512.png" },
      { property: "og:image:width", content: "512" },
      { property: "og:image:height", content: "512" },
      { property: "og:image:alt", content: "SEES — Secure End-to-End State" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "SEES" },
      { name: "twitter:title", content: "SEES — Secure End-to-End State" },
      { name: "twitter:description", content: "SEES is a zero-knowledge encrypted vault for files and notes. No email, no recovery, no backdoors. Your passphrase never leaves your device." },
      { name: "twitter:image", content: "https://www.sees.im/icon-512.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=3" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico?v=3" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png?v=3" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png?v=3" },
      { rel: "apple-touch-icon", href: "/icon-192.png?v=3" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://www.sees.im/#organization",
              name: "SEES",
              url: "https://www.sees.im/",
              logo: "https://www.sees.im/icon-512.png",
              sameAs: [],
            },
            {
              "@type": "SoftwareApplication",
              "@id": "https://www.sees.im/#software",
              name: "SEES",
              alternateName: "Secure End-to-End State",
              url: "https://www.sees.im/",
              description:
                "SEES is a zero-knowledge encrypted vault for files and notes. No email, no recovery, no backdoors. Your passphrase never leaves your device.",
              applicationCategory: "SecurityApplication",
              operatingSystem: "Any (Web)",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              publisher: { "@id": "https://www.sees.im/#organization" },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <VaultProvider>
        <Outlet />
        <Toaster
          position="top-right"
          richColors={false}
          closeButton
          offset={22}
          duration={4200}
        />
      </VaultProvider>
    </QueryClientProvider>
  );
}
