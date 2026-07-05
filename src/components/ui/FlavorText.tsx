import { cn } from "@/lib/cn";

export interface FlavorTextProps {
  children: React.ReactNode;
  className?: string;
}

export function FlavorText({ children, className }: FlavorTextProps) {
  return <p className={cn("font-flavor italic text-ink-muted", className)}>{children}</p>;
}
