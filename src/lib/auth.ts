'use server';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

import { adminDb } from '@/lib/firebase-admin';
import type { User } from '@/types';

export async function requireUserSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error('Unauthorized: Authentication required.');
  }
  return session;
}

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required.');
  }
  return session;
}

export async function requireLeaderOrAdminSession() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!role || (role !== 'admin' && role !== 'team_leader')) {
    throw new Error('Unauthorized: Team Leader or Admin access required.');
  }
  return session;
}

export async function getCurrentAppUser(): Promise<User> {
  const session = await requireUserSession();
  const userId = session.user.id;
  const userEmail = session.user.email?.toLowerCase();

  // Try finding by doc id
  if (userId) {
    try {
      const docSnap = await adminDb.collection('users').doc(userId).get();
      if (docSnap.exists) {
        const data = docSnap.data()!;
        return {
          id: docSnap.id,
          name: data.name || session.user.name || 'User',
          email: data.email || userEmail || '',
          role: data.role || (session.user as any).role || 'employee',
          avatarUrl: data.avatarUrl || session.user.image,
          mentorId: data.mentorId || null,
        };
      }
    } catch {
      // Continue to email lookup
    }
  }

  // Try finding by email
  if (userEmail) {
    try {
      const snap = await adminDb.collection('users')
        .where('email', '==', userEmail)
        .limit(1)
        .get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || session.user.name || 'User',
          email: data.email || userEmail,
          role: data.role || (session.user as any).role || 'employee',
          avatarUrl: data.avatarUrl || session.user.image,
          mentorId: data.mentorId || null,
        };
      }
    } catch {
      // Fall through
    }
  }

  return {
    id: userId || 'current-user',
    name: session.user.name || 'User',
    email: userEmail || '',
    role: (session.user as any).role || 'employee',
    avatarUrl: session.user.image || undefined,
    mentorId: null,
  };
}

