import NextAuth from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { NextAuthOptions, Provider } from 'next-auth';
import { adminDb } from '@/lib/firebase-admin';

// Stub auth must never run in production
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_STUB_AUTH === 'true') {
  throw new Error('FATAL: Stub authentication cannot be enabled in production.');
}

const useStubAuth = process.env.NEXT_PUBLIC_STUB_AUTH === 'true';

// Validate required env vars before the server starts
if (!useStubAuth) {
  const requiredVars = [
    'AUTH_SECRET',
    'AUTH_AZURE_AD_CLIENT_ID',
    'AUTH_AZURE_AD_CLIENT_SECRET',
    'AUTH_AZURE_AD_TENANT_ID',
  ];
  for (const v of requiredVars) {
    if (!process.env[v]) {
      throw new Error(`Missing required environment variable: ${v}`);
    }
  }
}

const providers: Provider[] = [];

if (useStubAuth) {
  providers.push(
    CredentialsProvider({
      name: 'Stubbed Login',
      credentials: {},
      async authorize(_credentials) {
        console.log('Authenticating with stub user.');
        return {
          id: 'stub-user-id-123',
          name: 'Local Developer',
          email: 'dev@example.com',
          image: 'https://placehold.co/100x100.png?text=LD',
        };
      },
    })
  );
} else {
  providers.push(
    AzureADProvider({
      clientId: process.env.AUTH_AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AUTH_AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AUTH_AZURE_AD_TENANT_ID!,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.AUTH_SECRET,
  ...(useStubAuth && { trustHost: true }),
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account && user) {
        if (!useStubAuth && profile) {
          token.accessToken = account.access_token;
          token.id = (profile as any).oid;
          // Look up the user's role from Firestore by their email
          try {
            const email = ((profile as any).email || (profile as any).preferred_username || '').toLowerCase();
            if (email) {
              const snap = await adminDb.collection('users')
                .where('email', '==', email)
                .limit(1)
                .get();
              token.role = snap.empty ? 'employee' : (snap.docs[0].data().role ?? 'employee');
            } else {
              token.role = 'employee';
            }
          } catch {
            token.role = 'employee';
          }
        }
        if (useStubAuth) {
          token.id = user.id;
          token.role = 'admin';
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.accessToken) {
        session.accessToken = token.accessToken;
      }
      if (token.id && session.user) {
        session.user.id = token.id;
      }
      if (token.role && session.user) {
        session.user.role = token.role as 'employee' | 'team_leader' | 'admin';
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
