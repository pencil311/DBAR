import Link from "next/link";
import { Stamp } from "@/components/ui";

export type QuickDrawState =
  | { kind: "unfiled" }
  | { kind: "filed"; label: string }
  | { kind: "noschool" };

export function QuickDraw({ state }: { state: QuickDrawState }) {
  if (state.kind === "filed") {
    return (
      <Link href="/mark" className="block">
        <Stamp variant="ink" className="block w-full !border-ink-muted text-center !text-ink-muted">
          Today Filed — {state.label}
        </Stamp>
      </Link>
    );
  }

  if (state.kind === "noschool") {
    return (
      <Link href="/mark" className="block">
        <Stamp variant="ink" className="block w-full !border-ink-muted text-center !text-ink-muted">
          No Court Today
        </Stamp>
      </Link>
    );
  }

  return (
    <Link href="/mark" className="block">
      <Stamp variant="ink" className="block w-full text-center text-lg">
        ✕ Mark Today
      </Stamp>
    </Link>
  );
}
