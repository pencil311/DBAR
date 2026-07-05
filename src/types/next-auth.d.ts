import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      classId: string | null;
      elective: "AE" | "FSWD" | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    classId?: string | null;
    elective?: "AE" | "FSWD" | null;
  }
}
