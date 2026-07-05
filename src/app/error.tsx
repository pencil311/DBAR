"use client";

import { useEffect } from "react";
import { Heading, FlavorText, PosterFrame, Stamp } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-4 text-center">
      <PosterFrame>
        <Heading size="lg" as="h1">
          The Trail Ends Here
        </Heading>
        <FlavorText className="mt-2">
          Something went sideways out on the range. Try again, or ride back to the poster.
        </FlavorText>
        <button type="button" onClick={reset} className="mt-4 block w-full">
          <Stamp variant="ink" className="block w-full text-center">
            Try Again
          </Stamp>
        </button>
      </PosterFrame>
    </main>
  );
}
