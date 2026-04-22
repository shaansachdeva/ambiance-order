import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { USER_FEATURES } from "@/types";
import type { UserRole } from "@/types";

// In-memory cache for session DB lookups. Session refetch fires on every
// window focus + every 5-10min interval per user — without this, a handful
// of logged-in users can exhaust the pg connection pool.
const SESSION_CACHE_MS = 30_000;
type CachedUser = { role: string; customPermissions: string[] | null; expiresAt: number };
const sessionCache = new Map<string, CachedUser>();

export function invalidateUserSessionCache(userId: string) {
  sessionCache.delete(userId);
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (!user || !user.active) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.username, // NextAuth expects email field
          role: user.role as UserRole,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user) return session;
      (session.user as any).role = token.role;
      (session.user as any).id = token.id;

      const userId = token.id as string | undefined;
      if (!userId) return session;

      const now = Date.now();
      const cached = sessionCache.get(userId);
      if (cached && cached.expiresAt > now) {
        (session.user as any).role = cached.role;
        (session.user as any).customPermissions = cached.customPermissions;
        return session;
      }

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, customPermissions: true },
        });
        const role = dbUser?.role ?? (token.role as string);
        const customPermissions = dbUser?.customPermissions
          ? (JSON.parse(dbUser.customPermissions) as string[])
          : null;
        sessionCache.set(userId, { role, customPermissions, expiresAt: now + SESSION_CACHE_MS });
        (session.user as any).role = role;
        (session.user as any).customPermissions = customPermissions;
      } catch {
        (session.user as any).customPermissions = null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
