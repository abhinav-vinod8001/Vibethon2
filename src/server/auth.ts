import type { NextAuthOptions } from "next-auth";
import { getToken } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  callbacks: {
    async jwt({ token, account }) {
      if (account)
        token.userId = `${account.provider}:${account.providerAccountId}`;
      return token;
    },
  },
};

/** Only cryptographically verified session cookies establish identity. */
export async function currentUser() {
  if (!process.env.NEXTAUTH_SECRET) return null;
  const incoming = await cookies();
  const token = await getToken({
    req: {
      cookies: Object.fromEntries(
        incoming.getAll().map((cookie) => [cookie.name, cookie.value]),
      ),
      headers: {},
    } as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie:
      process.env.NEXTAUTH_URL?.startsWith("https://") ??
      process.env.NODE_ENV === "production",
  });
  if (!token || typeof token.userId !== "string") return null;
  return { userId: token.userId, displayName: token.name || "JobSathi member" };
}
