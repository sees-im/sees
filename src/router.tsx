import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { routeTree } from "./routeTree.gen";

// The CSP nonce is generated per-request in src/server.ts and threaded
// through via a request header so the SSR-rendered <script> tags carry
// the same nonce as the Content-Security-Policy response header.
const getCspNonce = createIsomorphicFn()
  .server(() => getRequest().headers.get("x-csp-nonce") ?? undefined)
  .client(() => undefined);

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ssr: { nonce: getCspNonce() },
  });

  return router;
};
