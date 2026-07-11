"use client";

import { signIn } from "next-auth/react";
import { FlavorText, Heading, Stamp } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-center">
      <Heading size="xl" as="h1">
        DBar
      </Heading>
      <FlavorText>The frontier keeps a ledger. Sign in to settle yours.</FlavorText>
      <button type="button" onClick={() => signIn("google", { callbackUrl: "/" })}>
        <Stamp variant="ink" className="transition-colors hover:border-blood hover:text-blood">
          Ride In With Google
        </Stamp>
      </button>

      {process.env.NODE_ENV !== "production" && (
        <button type="button" onClick={() => signIn("dev", { callbackUrl: "/" })}>
          <Stamp variant="brass" className="transition-colors hover:border-blood hover:text-blood">
            Dev Login (local)
          </Stamp>
        </button>
      )}
    </main>
  );
}
