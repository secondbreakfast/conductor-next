import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    async signIn({ user }) {
      // Save/update user in database on each sign in
      if (user.email) {
        try {
          await prisma.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name || null,
              image: user.image || null,
              lastLoginAt: new Date(),
            },
            create: {
              email: user.email,
              name: user.name || null,
              image: user.image || null,
              lastLoginAt: new Date(),
            },
          });
        } catch (error) {
          console.error('Failed to save user:', error);
        }
      }
    },
  },
});
