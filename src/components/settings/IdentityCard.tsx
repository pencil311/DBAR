"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Heading, PosterFrame, Stamp } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface IdentityCardProps {
  name: string;
  email: string;
  image: string | null;
}

export function IdentityCard({ name, email, image }: IdentityCardProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  function handleSignOut() {
    setIsSigningOut(true);
    signOut({ callbackUrl: "/login" });
  }

  return (
    <PosterFrame>
      <div className="flex items-center gap-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- single external avatar, not worth remotePatterns config
          <img src={image} alt="" className="h-14 w-14 border-2 border-ink object-cover sepia" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center border-2 border-ink bg-paper-dark font-poster text-2xl text-ink">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <Heading size="sm" as="h2" className="truncate">
            {name}
          </Heading>
          <span className="truncate font-ledger text-sm text-ink-muted">{email}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="mt-3 block w-full"
      >
        <Stamp variant="blood" className={cn("block w-full text-center", isSigningOut && "opacity-50")}>
          {isSigningOut ? "Riding Out..." : "Ride Out — Sign Out"}
        </Stamp>
      </button>
    </PosterFrame>
  );
}
