"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Stamp } from "@/components/ui";
import { QuickDraw, type QuickDrawState } from "@/components/poster/QuickDraw";
import { hasQueuedFiling, QUEUE_SYNCED_EVENT } from "@/lib/offlineQueue";

export function HomeQuickDraw({ today, state }: { today: string; state: QuickDrawState }) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(hasQueuedFiling(today));

    function onSync(e: Event) {
      const detail = (e as CustomEvent<{ date: string }>).detail;
      if (detail?.date === today) setPending(false);
    }
    window.addEventListener(QUEUE_SYNCED_EVENT, onSync);
    return () => window.removeEventListener(QUEUE_SYNCED_EVENT, onSync);
  }, [today]);

  if (pending) {
    return (
      <Link href="/mark" className="block">
        <Stamp variant="ink" className="block w-full !border-ink-muted text-center !text-ink-muted">
          Today — Pending Wire
        </Stamp>
      </Link>
    );
  }

  return <QuickDraw state={state} />;
}
