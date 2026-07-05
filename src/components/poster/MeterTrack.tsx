import { cn } from "@/lib/cn";

export interface MeterTrackProps {
  /** 0-100 */
  percent: number;
  /** Tailwind background color class for the fill, e.g. "bg-lawful" */
  colorClass: string;
  className?: string;
  /** Optional overlay content positioned within the track (e.g. a hat marker). */
  children?: React.ReactNode;
}

export function MeterTrack({ percent, colorClass, className, children }: MeterTrackProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className={cn("relative h-3 w-full border border-border-dark bg-paper-dark", className)}>
      <div
        className={cn("h-full transition-[width] duration-300 ease-out", colorClass)}
        style={{ width: `${clamped}%` }}
      />
      {children}
    </div>
  );
}
