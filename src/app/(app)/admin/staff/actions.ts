
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import type { User } from '@/types';
import { revalidatePath } from 'next/cache';

/**
 * Fetches all users from the 'users' collection.
 * @returns A promise that resolves to an array of User objects.
 */
export async function getUsersAction(): Promise<User[]> {
  await requireAdminSession();
  try {
    const snapshot = await adminDb.collection('users').orderBy('name').get();
    if (snapshot.empty) {
      return [];
    }
    // Note: This assumes documents have the User structure.
    // Add validation if needed (e.g., with Zod).
    return snapshot.docs.map(doc => doc.data() as User);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    if (error.code === 5) { // NOT_FOUND
      console.log("The 'users' collection does not exist yet.");
      return [];
    }
    throw new Error("An unexpected error occurred while fetching users.");
  }
}

/**
 * Saves a user to the 'users' collection, either creating or updating.
 * @param user The user data to save. Can include an ID for updates.
 */
export async function saveUserAction(user: Omit<User, 'id'> & { id?: string }) {
  await requireAdminSession();
  const usersRef = adminDb.collection('users');
  
  try {
    if (user.id) {
      // Update existing user
      const userDocRef = usersRef.doc(user.id);
      await userDocRef.update({ ...user, email: user.email.toLowerCase() });
    } else {
      // Create new user
      const finalUserEmail = user.email.toLowerCase();

      // Check for email uniqueness
      const querySnapshot = await usersRef.where('email', '==', finalUserEmail).limit(1).get();
      if (!querySnapshot.empty) {
        throw new Error('A user with this email already exists.');
      }

      const newDocRef = usersRef.doc();
      const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
      
      await newDocRef.set({
        ...user,
        id: newDocRef.id,
        email: finalUserEmail,
        // Provide a default placeholder avatar if none is given
        avatarUrl: user.avatarUrl || `https://placehold.co/100x100.png?text=${initials}`
      });
    }
    revalidatePath('/admin/staff');
  } catch (error: any) {
    console.error("Error saving user:", error);
    // Re-throw specific, user-friendly errors
    if (error.message.includes('already exists')) {
        throw error;
    }
    throw new Error("Failed to save user due to a server error.");
  }
}

/**
 * Deletes a user from the 'users' collection.
 * @param userId The ID of the user to delete.
 */
export async function deleteUserAction(userId: string) {
  await requireAdminSession();
  try {
    await adminDb.collection('users').doc(userId).delete();
    revalidatePath('/admin/staff');
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new Error("Failed to delete user.");
  }
}
