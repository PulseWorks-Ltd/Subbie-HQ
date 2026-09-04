import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { formatUserName } from "@/lib/user-display";
import { isLoginRateLimited, isLoginRateLimitedByIp, recordFailedLoginAttempt } from "@/lib/login-rate-limit";
import { getClientIp } from "@/lib/public-token-rate-limit";

// Session cookie flags — no explicit `cookies` config below, so Auth.js
// v5's own defaults apply: HttpOnly is always true (not configurable to
// false), SameSite defaults to "lax", and Secure is applied automatically
// once Auth.js detects the request is HTTPS (via `trustHost` below plus
// the `x-forwarded-proto` header Railway sets, or via AUTH_URL starting
// with "https://") — at which point it also switches to the
// `__Secure-`/`__Host-` prefixed cookie names. Manual step: confirm the
// production AUTH_URL environment variable on Railway is the real
// `https://` domain (not http/localhost) — that's what this detection
// keys off, and it can't be verified from this codebase alone.
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Explicit rather than relying on Auth.js's own default (30 days) — 14
  // days meaningfully shrinks the window a stolen/leaked session cookie
  // stays valid for, while still comfortably outlasting how often someone
  // working a single job actually needs to re-authenticate (a subbie
  // checking in most weekdays won't notice this at all). Re-visit shorter
  // if that assumption turns out wrong in practice.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {}
      },
      authorize: async (credentials, request) => {
        const email = typeof credentials?.email === "string" ? credentials.email.toLowerCase().trim() : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) return null;

        const ip = getClientIp(request);

        // Same generic null-return either way as the checks below, so a
        // rate-limited request is indistinguishable from a wrong password —
        // it never leaks whether the email exists or that a limit was hit.
        // Two independent bounds: per-email (existing) catches repeated
        // guessing against one account; per-IP (coarser, see
        // lib/login-rate-limit.ts) catches one source spraying many
        // different email addresses, which the per-email bound alone would
        // never notice.
        if (await isLoginRateLimited(email)) return null;
        if (await isLoginRateLimitedByIp(ip)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          await recordFailedLoginAttempt(email, ip);
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          await recordFailedLoginAttempt(email, ip);
          return null;
        }

        return { id: user.id, email: user.email, name: formatUserName(user) };
      }
    })
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user?.id) {
        token.userId = user.id;
      }
      // Fired by the client calling useSession()'s update({ name }) after a
      // successful My Settings save (see components/settings/my-settings-tab.tsx)
      // — without this, session.user.name (and therefore TopNav) would keep
      // showing the old name until the next login, since JWT sessions don't
      // otherwise refresh mid-session.
      if (trigger === "update" && session?.name !== undefined) {
        token.name = session.name;
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
        const user = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { id: true, passwordChangedAt: true }
        });
        // "Invalidate existing sessions after a password reset" without any
        // server-side session store: a JWT session strategy stamps a
        // standard `iat` (issued-at) claim on every token, so any session
        // issued before the reset (lib/password-reset.ts sets
        // passwordChangedAt) simply never gets session.user.id set below —
        // same effect on every existing `session?.user?.id` check as the
        // deleted-user case above, achieved by the same per-request DB read
        // this callback already does, not a new mechanism.
        const tokenIssuedAtMs = typeof token.iat === "number" ? token.iat * 1000 : null;
        const invalidatedByPasswordReset =
          user?.passwordChangedAt != null && tokenIssuedAtMs !== null && tokenIssuedAtMs < user.passwordChangedAt.getTime();
        if (user && !invalidatedByPasswordReset) {
          session.user.id = token.userId as string;
        }
      }
      return session;
    }
  }
});
