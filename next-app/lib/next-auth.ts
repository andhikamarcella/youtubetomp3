import { createHash } from 'node:crypto';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

function stableUuid(provider: string, subject: string): string {
  const bytes = Buffer.from(createHash('sha256').update(`${provider}:${subject}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/cli-login' },
  callbacks: {
    async jwt({ token, account, profile }) {
      const subject = account?.providerAccountId || token.sub;
      const provider = account?.provider || 'google';
      if (subject) token.userId = stableUuid(provider, subject);
      if (profile?.email) token.email = profile.email;
      if (profile?.name) token.name = profile.name;
      if ((profile as any)?.picture) token.picture = (profile as any).picture;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        if (token.email) session.user.email = String(token.email);
        if (token.name) session.user.name = String(token.name);
        if (token.picture) session.user.image = String(token.picture);
      }
      return session;
    },
  },
};
