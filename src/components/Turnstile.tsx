import { useEffect, useId, useRef, useState } from "react";
import { getTurnstileSiteKey } from "@/lib/turnstile.server";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Turnstile"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function Turnstile({ onVerify }: { onVerify: (token: string | null) => void }) {
  const containerId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTurnstileSiteKey()
      .then(({ siteKey }) => {
        if (!cancelled) setSiteKey(siteKey);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: (token) => onVerify(token),
          "expired-callback": () => onVerify(null),
          "error-callback": () => onVerify(null),
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, onVerify]);

  if (failed || siteKey === null) return null;

  return <div ref={containerRef} id={`turnstile-${containerId}`} className="turnstile-widget" />;
}
