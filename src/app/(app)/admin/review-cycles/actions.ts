
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import type { ReviewCycle } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const SaveReviewCycleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  participantIds: z.array(z.string()),
  status: z.enum(['draft', 'active', 'closed']),
});

/**
 * Saves a new or updates an existing review cycle.
 * @param data The review cycle data.
 */
export async function saveReviewCycleAction(data: Omit<ReviewCycle, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }) {
  await requireAdminSession();
  const validated = SaveReviewCycleSchema.parse(data);
  const cyclesRef = adminDb.collection('review-cycles');
  const now = Timestamp.now();

  if (validated.id) {
    // Update existing cycle
    const docRef = cyclesRef.doc(validated.id);
    await docRef.update({ ...validated, updatedAt: now });
  } else {
    // Create new cycle
    const newDocRef = cyclesRef.doc();
    await newDocRef.set({
      ...validated,
      id: newDocRef.id,
      createdAt: now,
      updatedAt: now,
    });
  }
  revalidatePath('/admin/review-cycles');
}

/**
 * Fetches all review cycles, ordered by start date descending.
 * @returns A promise resolving to an array of ReviewCycle objects.
 */
export async function getReviewCyclesAction(): Promise<ReviewCycle[]> {
  await requireAdminSession();
  try {
    const snapshot = await adminDb.collection('review-cycles').orderBy('startDate', 'desc').get();
    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
        startDate: (data.startDate as Timestamp).toDate().toISOString(),
        endDate: (data.endDate as Timestamp).toDate().toISOString(),
      } as ReviewCycle;
    });
  } catch (error) {
    console.error('Error fetching review cycles:', error);
    // In case of a missing index, Firestore throws a specific error.
    // This allows the page to load without crashing.
    return [];
  }
}

/**
 * Fetches all active review cycles.
 * @returns A promise resolving to an array of active ReviewCycle objects.
 */
export async function getActiveReviewCyclesAction(): Promise<ReviewCycle[]> {
    await requireAdminSession();
    try {
      const snapshot = await adminDb.collection('review-cycles')
          .where('status', '==', 'active')
          .orderBy('startDate', 'desc')
          .get();

      if (snapshot.empty) return [];

      return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
            startDate: (data.startDate as Timestamp).toDate().toISOString(),
            endDate: (data.endDate as Timestamp).toDate().toISOString(),
          } as ReviewCycle;
      });
    } catch (error: any) {
       if (error.code === 9) { // 9 is FAILED_PRECONDITION for missing index
        console.error(
          "Firestore error: The query for active review cycles requires a composite index. " +
          "Please check the error details below for a link to create it in your Firebase console.",
          error
        );
        return [];
      }
      console.error(`An unexpected error occurred while fetching active review cycles:`, error);
      throw error;
    }
}
