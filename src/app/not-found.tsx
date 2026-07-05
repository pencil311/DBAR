import Link from "next/link";
import { Heading, FlavorText, PosterFrame, Stamp } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-4 text-center">
      <PosterFrame>
        <Heading size="lg" as="h1">
          The Trail Ends Here
        </Heading>
        <FlavorText className="mt-2">
          No such claim on file, partner. This trail runs cold.
        </FlavorText>
        <Link href="/" className="mt-4 inline-block">
          <Stamp variant="ink" className="text-center">
            Back to the Poster
          </Stamp>
        </Link>
      </PosterFrame>
    </main>
  );
}
