"use client";

import { useEffect, useState } from "react";
import { PosterFrame, Heading, FlavorText, Stamp } from "@/components/ui";
import { cn } from "@/lib/cn";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallCard() {
  const [installed, setInstalled] = useState(true);
  const [ios, setIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIOS());

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!ios && !deferredPrompt)) {
    return null;
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstalling(false);
  }

  return (
    <PosterFrame>
      <Heading size="sm" as="h2">
        Add to Your Saddlebag
      </Heading>
      {ios ? (
        <FlavorText className="mt-2 text-sm">
          Tap Share, then &ldquo;Add to Home Screen&rdquo; — ride with DBar in your pocket, no store
          required.
        </FlavorText>
      ) : (
        <>
          <FlavorText className="mt-2 text-sm">
            Keep DBar a tap away — install it like a real app, no store required.
          </FlavorText>
          <button type="button" onClick={handleInstall} disabled={installing} className="mt-3">
            <Stamp variant="brass" className={cn("text-center", installing && "opacity-50")}>
              {installing ? "Saddling Up..." : "Install DBar"}
            </Stamp>
          </button>
        </>
      )}
    </PosterFrame>
  );
}
