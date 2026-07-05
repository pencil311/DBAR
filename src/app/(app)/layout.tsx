import { BottomTabBar } from "@/components/BottomTabBar";
import { OfflineQueueSync } from "@/components/OfflineQueueSync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-16">{children}</div>
      <BottomTabBar />
      <OfflineQueueSync />
    </>
  );
}
