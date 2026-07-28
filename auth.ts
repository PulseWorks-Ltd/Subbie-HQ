import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {}
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email.toLowerCase().trim() : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        return { id: user.id, email: user.email, name: user.name };
      }
    })
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.userId) {
        // Sessions are JWT-based (stateless) — a cookie issued before a
        // database reset/restore still decodes fine and still carries the
        // old userId, even though that User row no longer exists. Leaving
        // session.user.id unset in that case makes every existing
        // `session?.user?.id` check across the app (pages redirect to
        // /login, API routes 401) treat it as logged out, instead of
        // downstream code hitting a raw FK-constraint crash the first time
        // it tries to write something referencing that userId.
        const user = await prisma.user.findUnique({ where: { id: token.userId as string }, select: { id: true } });
        if (user) {
          session.user.id = token.userId as string;
        }
      }
      return session;
    }
  }
});
