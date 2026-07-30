import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS
      // @ts-expect-error legacy iOS Safari property
      window.navigator.standalone === true;
    if (standalone) setInstalled(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent ?? "");

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (isIos) {
      setShowIosHint((s) => !s);
    }
  };

  // Hide entirely if not installable and not iOS
  if (!deferred && !isIos) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        title="Install SEES to your Home Screen"
        className={`flex items-center gap-2 px-3 py-2 border border-accent/40 text-accent font-mono text-[10px] uppercase tracking-widest hover:bg-accent hover:text-accent-foreground transition-colors ${className}`}
      >
        <Download className="size-3.5" />
        <span className="hidden sm:inline">Install</span>
      </button>
      {showIosHint && (
        <div className="absolute right-0 mt-2 w-72 bg-surface border border-border p-4 z-50 shadow-lg">
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-2">
            Add to Home Screen
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
            <Share className="size-3.5 mt-0.5 shrink-0 text-accent" />
            <span>
              Tap the <strong className="text-foreground">Share</strong> icon in Safari, then choose{" "}
              <strong className="text-foreground">"Add to Home Screen"</strong>.
            </span>
          </p>
          <button
            onClick={() => setShowIosHint(false)}
            className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
