import { FlavorText, Heading, PosterFrame } from "@/components/ui";

export function ThemedMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center p-4">
      <PosterFrame>
        <div className="flex flex-col items-center gap-2 text-center">
          <Heading size="md" as="h1">
            {title}
          </Heading>
          <FlavorText>{children}</FlavorText>
        </div>
      </PosterFrame>
    </main>
  );
}
