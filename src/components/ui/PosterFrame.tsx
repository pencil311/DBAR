import { cn } from "@/lib/cn";

export interface PosterFrameProps {
  children: React.ReactNode;
  variant?: "paper" | "paper-dark";
  className?: string;
}

export function PosterFrame({ children, variant = "paper", className }: PosterFrameProps) {
  return (
    <div className={cn("border-[3px] border-double border-ink p-[3px]", className)}>
      <div
        className={cn(
          "border border-ink p-4",
          variant === "paper-dark" ? "bg-paper-dark" : "bg-paper"
        )}
      >
        {children}
      </div>
    </div>
  );
}
