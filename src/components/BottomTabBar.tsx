"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/", label: "Poster" },
  { href: "/mark", label: "Mark" },
  { href: "/ledger", label: "Ledger" },
  { href: "/subjects", label: "Docket" },
  { href: "/grades", label: "Grades" },
  { href: "/ask", label: "Marshal" },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t-[3px] border-double border-ink bg-paper">
      {TABS.map((tab) => {
        const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex-1 border-b-[3px] py-3 text-center font-ledger text-[11px] sm:text-sm uppercase tracking-wide",
              isActive ? "border-brass text-ink" : "border-transparent text-ink-muted"
            )}
          >
            <span className="relative inline-block">
              {tab.label}
              {tab.label === "Marshal" && (
                <span className="absolute -right-3 -top-1 font-poster text-[10px] text-brass">✦</span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
