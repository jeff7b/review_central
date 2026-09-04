'use server';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

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

