import { cn } from "@/lib/cn";

export interface HeadingProps {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p";
}

const sizeClasses = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-6xl",
} as const;

export function Heading({ children, size = "md", className, as: Tag = "h2" }: HeadingProps) {
  return (
    <Tag className={cn("font-poster uppercase tracking-wide text-ink", sizeClasses[size], className)}>
      {children}
    </Tag>
  );
}
