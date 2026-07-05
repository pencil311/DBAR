import { cn } from "@/lib/cn";

export interface StampProps {
  children: React.ReactNode;
  variant?: "blood" | "ink" | "brass";
  className?: string;
}

const variantClasses = {
  blood: "border-blood text-blood",
  ink: "border-ink text-ink",
  brass: "border-brass text-brass",
} as const;

export function Stamp({ children, variant = "ink", className }: StampProps) {
  return (
    <span
      className={cn(
        "inline-block -rotate-2 border-[3px] px-3 py-1 font-poster uppercase tracking-widest",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
