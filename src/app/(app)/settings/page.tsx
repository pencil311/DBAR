import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { User } from "@/lib/models/User";
import { VERIFICATION_DATES } from "@/lib/engine";
import { formatDisplayDate } from "@/lib/dates";
import { Heading, FlavorText, PosterFrame } from "@/components/ui";
import { InstallCard } from "@/components/settings/InstallCard";
import { IdentityCard } from "@/components/settings/IdentityCard";
import { ElectiveCard } from "@/components/settings/ElectiveCard";
import { OutfitCard } from "@/components/settings/OutfitCard";

export default async function SettingsPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-8">
        <FlavorText className="text-center">Sign in to see your settings.</FlavorText>
      </main>
    );
  }

  await connectToDatabase();

  const classId = session.user.classId;
  const [currentClass, allClasses, memberCounts] = await Promise.all([
    classId ? Class.findById(classId).lean() : null,
    Class.find({}).sort({ name: 1 }).lean(),
    User.aggregate<{ _id: unknown; count: number }>([
      { $match: { classId: { $ne: null } } },
      { $group: { _id: "$classId", count: { $sum: 1 } } },
    ]),
  ]);

  const memberCountByClassId = new Map(memberCounts.map((m) => [String(m._id), m.count]));

  const joinableClasses = allClasses.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    memberCount: memberCountByClassId.get(c._id.toString()) ?? 0,
  }));

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-8">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <Heading size="lg" as="h1">
          Settings
        </Heading>
        <FlavorText>The paperwork behind the badge.</FlavorText>
      </header>

      <InstallCard />

      <IdentityCard
        name={session.user.name ?? "Stranger"}
        email={session.user.email ?? ""}
        image={session.user.image ?? null}
      />

      <ElectiveCard elective={session.user.elective} />

      <OutfitCard
        currentClassId={classId}
        currentClassName={currentClass?.name ?? null}
        holidays={currentClass?.holidays ?? []}
        joinableClasses={joinableClasses}
      />

      <PosterFrame variant="paper-dark">
        <Heading size="sm" as="h2">
          The Marshal&rsquo;s Dates
        </Heading>
        <div className="mt-2 flex flex-col gap-1">
          {VERIFICATION_DATES.map((date) => (
            <p key={date} className="font-ledger text-sm text-ink">
              {formatDisplayDate(date)}
            </p>
          ))}
        </div>
        <FlavorText className="mt-2 text-sm">Set by the county.</FlavorText>
      </PosterFrame>
    </main>
  );
}
