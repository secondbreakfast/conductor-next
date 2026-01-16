import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

const ALLOWED_DOMAIN = 'owner.com';
const isDev = process.env.NODE_ENV === 'development';
const hasGoogleOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

const providers: NextAuthConfig['providers'] = [];

if (hasGoogleOAuth) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    })
  );
}

if (isDev && !hasGoogleOAuth) {
  providers.push(
    Credentials({
      id: 'dev-credentials',
      name: 'Dev Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        if (!email?.endsWith('@owner.com')) {
          return null;
        }
        return {
          id: 'dev-user',
          email,
          name: email.split('@')[0],
        };
      },
    })
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const domain = user.email.split('@')[1];
      if (domain !== ALLOWED_DOMAIN) {
        console.log(
          `[Auth] Rejected login attempt: ${user.email} (not @${ALLOWED_DOMAIN})`
        );
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Public routes that don't require authentication
      const publicRoutes = [
        '/auth/signin',
        '/auth/error',
        '/api/auth',
        '/api/runs',
        '/api/flows',
        '/api/prompts',
        '/api/upload',
        '/api/models',
      ];

      const isPublicRoute = publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + '/')
      );

      if (isPublicRoute) return true;
      if (isLoggedIn) return true;

      return false; // Redirect to login
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  trustHost: true,
};
