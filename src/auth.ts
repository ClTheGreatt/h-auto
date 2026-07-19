import { cache } from "react";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

// Fixed dummy hash to equalize response time when the user doesn't exist.
// Prevents timing-based user enumeration (bcrypt.compare always runs).
const DUMMY_BCRYPT_HASH =
  "$2b$10$abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyz012345";

// Deduped per request: the jwt callback re-validates against the DB on every
// request (not just sign-in), so a suspended account or a password change
// (which bumps tokenVersion) takes effect on the very next request instead
// of waiting out the JWT's natural expiry.
const getUserForSessionCheck = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, role: true, tokenVersion: true, tourCompletedAt: true },
  });
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Trim only — email casing as entered by an admin (or at signup)
        // is preserved in the DB, so the login lookup must be
        // case-insensitive rather than forcing lowercase on the input.
        const emailInput = String(credentials.email).trim();

        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: emailInput,
              mode: "insensitive",
            },
          },
        });

        const valid = await bcrypt.compare(
          credentials.password as string,
          user?.passwordHash ?? DUMMY_BCRYPT_HASH
        );

        if (!user || !valid || user.status !== "ACTIVE") return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          tokenVersion: user.tokenVersion,
          tourCompletedAt: user.tourCompletedAt
            ? user.tourCompletedAt.toISOString()
            : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in — populate from the just-verified user.
        token.id = user.id;
        token.role = user.role as UserRole;
        token.tokenVersion = user.tokenVersion;
        token.tourCompletedAt = user.tourCompletedAt
          ? new Date(user.tourCompletedAt).toISOString()
          : null;
        return token;
      }

      // Every subsequent request: re-check the DB. Returning null here
      // invalidates the session immediately (used to revoke suspended
      // accounts and sessions superseded by a password change).
      const fresh = await getUserForSessionCheck(token.id as string);
      if (
        !fresh ||
        fresh.status !== "ACTIVE" ||
        fresh.tokenVersion !== token.tokenVersion
      ) {
        return null;
      }

      token.role = fresh.role;
      token.tourCompletedAt = fresh.tourCompletedAt
        ? fresh.tourCompletedAt.toISOString()
        : null;
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.tourCompletedAt = (token.tourCompletedAt as string | null) ?? null;
      }
      return session;
    },
  },
});
