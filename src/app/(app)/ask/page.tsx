import { getServerAuthSession } from "@/lib/auth";
import { Heading, FlavorText, PosterFrame } from "@/components/ui";
import { NoClassMessage } from "@/components/NoClassMessage";
import { AskMarshal } from "@/components/ai/AskMarshal";

export default async function AskPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.classId) {
    return <NoClassMessage reason="before the Marshal has any records to check" />;
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-8">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <Heading size="lg" as="h1">
          The Marshal
        </Heading>
        <FlavorText>Ask about the ledger. He reads it before he speaks.</FlavorText>
      </header>

      <PosterFrame>
        <AskMarshal />
      </PosterFrame>
    </main>
  );
}
