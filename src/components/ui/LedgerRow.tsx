import { cn } from "@/lib/cn";

export interface LedgerRowProps {
  label: string;
  value: string;
  className?: string;
}

export function LedgerRow({ label, value, className }: LedgerRowProps) {
  return (
    <div className={cn("flex items-baseline gap-2 font-ledger text-ink", className)}>
      <span>{label}</span>
      <span className="mb-1 flex-1 border-b border-dotted border-ink-muted" />
      <span>{value}</span>
    </div>
  );
}
