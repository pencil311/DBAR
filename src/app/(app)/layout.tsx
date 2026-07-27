import { BottomTabBar } from "@/components/BottomTabBar";
import { OfflineQueueSync } from "@/components/OfflineQueueSync";
import { MarshalFloater } from "@/components/ai/MarshalFloater";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-16">{children}</div>
      <BottomTabBar />
      <MarshalFloater />
      <OfflineQueueSync />
    </>
  );
}
