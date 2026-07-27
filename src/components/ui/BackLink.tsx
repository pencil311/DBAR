"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { consumeInternalNavigation } from "@/lib/backNav";

/**
 * Themed back control for pages reached sideways rather than through the tab
 * bar. Walks real history when the page was opened from inside the app; a deep
 * link or a fresh PWA launch has nothing of ours to go back to, so those fall
 * through to `fallback` instead of stepping out of DBar entirely.
 */
export function BackLink({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(consumeInternalNavigation());
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        if (canGoBack) router.back();
        else router.push(fallback);
      }}
      className="flex items-center gap-1 self-start font-ledger text-sm uppercase tracking-wide text-ink transition-colors hover:text-blood"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M15 19l-7-7 7-7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back
    </button>
  );
}
