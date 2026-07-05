import { Heading, FlavorText, PosterFrame } from "@/components/ui";

/**
 * Precached by the service worker (see src/app/sw.js/route.ts) and served
 * when a navigation fails entirely offline with no cached page to fall
 * back on. Deliberately static — no session/data fetching — so it always
 * renders from cache with nothing left to fail.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 p-4 pt-24 text-center">
      <PosterFrame>
        <Heading size="md" as="h1">
          No Telegraph Line
        </Heading>
        <FlavorText className="mt-2">
          You&rsquo;re off the grid, partner. Reconnect to file reports.
        </FlavorText>
      </PosterFrame>
    </main>
  );
}
