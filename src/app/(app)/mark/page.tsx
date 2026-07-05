import { redirect } from "next/navigation";
import { todayIST } from "@/lib/dates";

// `redirect()` and `todayIST()` alone don't opt this route out of static
// rendering (only cookies()/headers()/searchParams do) — without this, the
// redirect target gets frozen at build time instead of evaluated per request.
export const dynamic = "force-dynamic";

export default function MarkIndexPage() {
  redirect(`/mark/${todayIST()}`);
}
