import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { DEMO_MODE, DEMO_USER } from "@/lib/demo";

/**
 * Local-only login so the app is usable without Google OAuth credentials.
 * Enabled ONLY when NODE_ENV !== "production", so it can never reach a
 * deployed build. Signs in a single fixed local user.
 */
export const DEV_LOGIN_ENABLED = process.env.NODE_ENV !== "production";
export const DEV_USER = {
  id: "dev-local",
  email: "dev@local.test",
  name: "Local Deputy",
} as const;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    ...(DEV_LOGIN_ENABLED
      ? [
          CredentialsProvider({
            id: "dev",
            name: "Dev Login",
            credentials: {},
            authorize: async () => ({ ...DEV_USER }),
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours — rolling refresh for active users
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile, trigger, session }) {
      // Google sign-in carries a profile; the dev credentials provider doesn't.
      const isGoogle = account?.provider === "google" && profile;
      const isDev = DEV_LOGIN_ENABLED && account?.provider === "dev";

      if (isGoogle || isDev) {
        await connectToDatabase();

        const { googleId, email, name, image } = isGoogle
          ? {
              googleId: account!.providerAccountId,
              email: (profile as GoogleProfile).email,
              name: (profile as GoogleProfile).name,
              image: (profile as GoogleProfile).picture,
            }
          : { googleId: DEV_USER.id, email: DEV_USER.email, name: DEV_USER.name, image: undefined };

        const user = await User.findOneAndUpdate(
          { googleId },
          {
            $setOnInsert: {
              googleId,
              email,
              name,
              image,
              classId: null,
              elective: null,
              createdAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );

        token.userId = user._id.toString();
        token.classId = user.classId ? user.classId.toString() : null;
        token.elective = user.elective;
      }

      // Settings-page mutations (elective, join/switch/forge a class) change
      // the User doc server-side but can't touch this JWT directly — the
      // client calls useSession().update(data) afterward, which re-invokes
      // this callback with trigger "update" so the session reflects the
      // change immediately instead of only after the next sign-in.
      if (trigger === "update" && session) {
        if ("classId" in session) token.classId = session.classId;
        if ("elective" in session) token.elective = session.elective;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.classId = token.classId ?? null;
        session.user.elective = token.elective ?? null;
      }
      return session;
    },
  },
};

export async function getServerAuthSession(): Promise<Session | null> {
  // Demo mode: no login — resolve the seeded demo user straight from the DB.
  if (DEMO_MODE) {
    await connectToDatabase();
    const user = await User.findOne({ googleId: DEMO_USER.googleId });
    if (!user) return null;
    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        image: user.image ?? null,
        classId: user.classId ? user.classId.toString() : null,
        elective: user.elective,
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return getServerSession(authOptions);
}
