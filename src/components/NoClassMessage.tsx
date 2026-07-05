import Link from "next/link";
import { ThemedMessage } from "@/components/ThemedMessage";

export function NoClassMessage({ reason = "before you can continue" }: { reason?: string }) {
  return (
    <ThemedMessage title="No Outfit Assigned">
      Pick a class in{" "}
      <Link href="/settings" className="text-blood underline underline-offset-2">
        Settings
      </Link>{" "}
      {reason}.
    </ThemedMessage>
  );
}
