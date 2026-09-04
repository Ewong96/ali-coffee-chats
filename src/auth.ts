import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DEV_FAKE_TOKEN } from "@/lib/google";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");

/** Local-only shortcut: sign in as any allow-listed email without Google. Never enabled in production. */
export const DEV_LOGIN_ENABLED = process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/member/login", error: "/member/login" },
  providers: [
    ...(DEV_LOGIN_ENABLED
      ? [
          Credentials({
            id: "dev-login",
            name: "Dev login",
            credentials: { email: { label: "Email" } },
            async authorize(creds) {
              const email = String(creds?.email ?? "").toLowerCase();
              return email ? { id: email, email, name: email.split("@")[0] } : null;
            },
          }),
        ]
      : []),
    Google({
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  callbacks: {
    // Only allow-listed eboard members may sign in. Persist their refresh token.
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const isDev = DEV_LOGIN_ENABLED && account?.provider === "dev-login";
      if (!isDev && account?.provider !== "google") return false;
      const db = await getDb();
      const member = await db.query.members.findFirst({ where: eq(schema.members.email, email) });
      if (!member || !member.active) return "/member/login?error=NotAllowed";
      if (isDev) {
        // Fake calendar connection so the booking flow can be exercised locally.
        if (!member.googleRefreshToken) {
          await db.update(schema.members).set({ googleRefreshToken: DEV_FAKE_TOKEN, googleConnectedAt: new Date(), name: member.name || user.name || "" }).where(eq(schema.members.id, member.id));
        }
        return true;
      }

      const patch: Partial<typeof schema.members.$inferInsert> = {};
      if (!member.name && user.name) patch.name = user.name;
      if (user.image) patch.image = user.image;
      if (account.refresh_token) {
        patch.googleRefreshToken = account.refresh_token;
        patch.googleConnectedAt = new Date();
      }
      if (Object.keys(patch).length) {
        await db.update(schema.members).set(patch).where(eq(schema.members.id, member.id));
      }
      return true;
    },
    async session({ session, token }) {
      if (token.email) session.user.email = token.email;
      return session;
    },
  },
});

/** Returns the signed-in member row, or null. */
export async function currentMember() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const db = await getDb();
  const member = await db.query.members.findFirst({ where: eq(schema.members.email, email) });
  return member && member.active ? member : null;
}
