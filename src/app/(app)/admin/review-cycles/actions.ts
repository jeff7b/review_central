
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import type { ReviewCycle } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

function toISOString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof (val as any).toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date(val as any).toISOString();
}

const SaveReviewCycleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  startDate: z.union([z.string().min(1, 'Start date is required'), z.date()]),
  endDate: z.union([z.string().min(1, 'End date is required'), z.date()]),
  participantIds: z.array(z.string()),
  status: z.enum(['draft', 'active', 'closed']),
});

/**
 * Saves a new or updates an existing review cycle.
 * @param data The review cycle data.
 */
export async function saveReviewCycleAction(
  data: Omit<ReviewCycle, 'createdAt' | 'updatedAt' | 'id' | 'startDate' | 'endDate'> & {
    id?: string;
    startDate: string | Date;
    endDate: string | Date;
  }
) {
  await requireAdminSession();
  const validated = SaveReviewCycleSchema.parse(data);
  const cyclesRef = adminDb.collection('review-cycles');
  const now = Timestamp.now();

  const startDate =
    validated.startDate instanceof Date
      ? Timestamp.fromDate(validated.startDate)
      : Timestamp.fromDate(new Date(validated.startDate));

  const endDate =
    validated.endDate instanceof Date
      ? Timestamp.fromDate(validated.endDate)
      : Timestamp.fromDate(new Date(validated.endDate));

  const cyclePayload = {
    name: validated.name,
    status: validated.status,
    participantIds: validated.participantIds,
    startDate,
    endDate,
    updatedAt: now,
  };

  if (validated.id) {
    // Update existing cycle
    const docRef = cyclesRef.doc(validated.id);
    await docRef.update(cyclePayload);
  } else {
    // Create new cycle
    const newDocRef = cyclesRef.doc();
    await newDocRef.set({
      ...cyclePayload,
      id: newDocRef.id,
      createdAt: now,
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
        createdAt: toISOString(data.createdAt),
        updatedAt: toISOString(data.updatedAt),
        startDate: toISOString(data.startDate),
        endDate: toISOString(data.endDate),
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
            createdAt: toISOString(data.createdAt),
            updatedAt: toISOString(data.updatedAt),
            startDate: toISOString(data.startDate),
            endDate: toISOString(data.endDate),
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
