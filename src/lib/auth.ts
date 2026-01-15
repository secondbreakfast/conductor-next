import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { createServiceClient } from './supabase/server';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    async signIn({ user }) {
      // Save/update user in database on each sign in
      if (user.email) {
        try {
          const supabase = createServiceClient();
          await supabase.from('users').upsert(
            {
              email: user.email,
              name: user.name || null,
              image: user.image || null,
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'email' }
          );
        } catch (error) {
          console.error('Failed to save user:', error);
        }
      }
    },
  },
});
