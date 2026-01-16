import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { db, users } from './db';
import { eq } from 'drizzle-orm';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    async signIn({ user }) {
      // Save/update user in database on each sign in
      if (user.email) {
        try {
          await db
            .insert(users)
            .values({
              email: user.email,
              name: user.name || null,
              image: user.image || null,
              lastLoginAt: new Date(),
            })
            .onConflictDoUpdate({
              target: users.email,
              set: {
                name: user.name || null,
                image: user.image || null,
                lastLoginAt: new Date(),
                updatedAt: new Date(),
              },
            });
        } catch (error) {
          console.error('Failed to save user:', error);
        }
      }
    },
  },
});
