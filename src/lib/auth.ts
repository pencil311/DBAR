import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
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
      if (account && profile) {
        await connectToDatabase();
        const googleProfile = profile as GoogleProfile;
        const googleId = account.providerAccountId;

        const user = await User.findOneAndUpdate(
          { googleId },
          {
            $setOnInsert: {
              googleId,
              email: googleProfile.email,
              name: googleProfile.name,
              image: googleProfile.picture,
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

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
