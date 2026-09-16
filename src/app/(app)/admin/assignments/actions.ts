
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import type { PeerReviewAssignment, User } from '@/types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const UserSummarySchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'User name is required'),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
  role: z.string().optional(),
});

const SaveAssignmentSchema = z.object({
  id: z.string().optional(),
  reviewCycleId: z.string().min(1, 'Review cycle ID is required'),
  reviewee: UserSummarySchema,
  reviewer: UserSummarySchema,
  questionnaireId: z.string().min(1, 'Questionnaire ID is required'),
  status: z.enum(['pending', 'in_progress', 'completed', 'declined']),
  dueDate: z.string().min(1, 'Due date is required'),
});

const CycleIdSchema = z.string().min(1, 'Review cycle ID is required');
const AssignmentIdSchema = z.string().min(1, 'Assignment ID is required');

/**
 * Saves a peer review assignment.
 * @param data The assignment data.
 */
export async function saveAssignmentAction(
  data: Omit<PeerReviewAssignment, 'id' | 'createdAt' | 'updatedAt' | 'revieweeName' | 'revieweeAvatarUrl' | 'reviewerName' | 'reviewerAvatarUrl'> & {
    id?: string;
    reviewee: User;
    reviewer: User;
  }
) {
  await requireAdminSession();
  const validated = SaveAssignmentSchema.parse(data);
  const assignmentsRef = adminDb.collection('peer-review-assignments');
  const now = Timestamp.now();

  const assignmentPayload = {
    reviewCycleId: validated.reviewCycleId,
    revieweeId: validated.reviewee.id,
    revieweeName: validated.reviewee.name,
    revieweeAvatarUrl: validated.reviewee.avatarUrl || '',
    reviewerId: validated.reviewer.id,
    reviewerName: validated.reviewer.name,
    reviewerAvatarUrl: validated.reviewer.avatarUrl || '',
    questionnaireId: validated.questionnaireId,
    status: validated.status,
    dueDate: validated.dueDate,
    updatedAt: now,
    ...(validated.status === 'pending' ? { reviewId: FieldValue.delete() } : {}),
  };

  if (validated.id) {
    // Update existing assignment
    const docRef = assignmentsRef.doc(validated.id);
    await docRef.update(assignmentPayload);
  } else {
    // Create new assignment
    const newDocRef = assignmentsRef.doc();
    await newDocRef.set({
      ...assignmentPayload,
      id: newDocRef.id,
      createdAt: now,
    });
  }

  revalidatePath('/admin/assignments');
}

/**
 * Fetches all assignments for a given review cycle.
 * @param reviewCycleId The ID of the review cycle.
 * @returns A promise resolving to an array of PeerReviewAssignment objects.
 */
export async function getAssignmentsByCycleAction(reviewCycleId: string): Promise<PeerReviewAssignment[]> {
  await requireAdminSession();
  const validatedCycleId = CycleIdSchema.parse(reviewCycleId);
  try {
    const snapshot = await adminDb.collection('peer-review-assignments')
      .where('reviewCycleId', '==', validatedCycleId)
      .get();
    
    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        updatedAt: (data.updatedAt as Timestamp).toDate().toISOString(),
      } as PeerReviewAssignment;
    });
  } catch (error) {
    console.error(`Error fetching assignments for cycle ${reviewCycleId}:`, error);
    return [];
  }
}

/**
 * Deletes a peer review assignment.
 * @param assignmentId The ID of the assignment to delete.
 */
export async function deleteAssignmentAction(assignmentId: string) {
  await requireAdminSession();
  const validatedId = AssignmentIdSchema.parse(assignmentId);
  try {
    await adminDb.collection('peer-review-assignments').doc(validatedId).delete();
    revalidatePath('/admin/assignments');
  } catch (error) {
    console.error('Error deleting assignment:', error);
    throw new Error('Failed to delete assignment.');
  }
}

/**
 * Clears a submitted review for an assignment so it can be redone.
 * Resets status to 'pending', deletes the reviewId reference, and removes any linked review document.
 * @param assignmentId The ID of the assignment to clear.
 */
export async function clearSubmittedReviewAction(assignmentId: string) {
  await requireAdminSession();
  const validatedId = AssignmentIdSchema.parse(assignmentId);
  try {
    const assignmentRef = adminDb.collection('peer-review-assignments').doc(validatedId);
    const assignmentDoc = await assignmentRef.get();

    if (!assignmentDoc.exists) {
      throw new Error('Assignment not found.');
    }

    const assignmentData = assignmentDoc.data();
    const reviewId = assignmentData?.reviewId;

    // Delete any linked review document from 'peer-reviews' and 'reviews'
    if (reviewId) {
      await adminDb.collection('peer-reviews').doc(reviewId).delete().catch(() => {});
      await adminDb.collection('reviews').doc(reviewId).delete().catch(() => {});
    }

    // Also remove any review documents matching this assignmentId
    const matchingPeerReviews = await adminDb.collection('peer-reviews')
      .where('assignmentId', '==', validatedId)
      .get()
      .catch(() => null);
    if (matchingPeerReviews && !matchingPeerReviews.empty) {
      const batch = adminDb.batch();
      matchingPeerReviews.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit().catch(() => {});
    }

    // Reset the assignment status to pending and remove reviewId
    await assignmentRef.update({
      status: 'pending',
      reviewId: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    });

    revalidatePath('/admin/assignments');
    return { success: true };
  } catch (error) {
    console.error('Error clearing submitted review:', error);
    throw new Error('Failed to clear submitted review.');
  }
}

/**
 * Clears all submitted reviews for a given review cycle so they can be redone.
 * Resets their status to 'pending' and deletes linked review documents.
 * @param reviewCycleId The ID of the review cycle.
 * @returns An object with success status and count of cleared reviews.
 */
export async function clearAllSubmittedReviewsAction(reviewCycleId: string): Promise<{ success: boolean; count: number }> {
  await requireAdminSession();
  const validatedCycleId = CycleIdSchema.parse(reviewCycleId);
  try {
    const snapshot = await adminDb.collection('peer-review-assignments')
      .where('reviewCycleId', '==', validatedCycleId)
      .where('status', '==', 'completed')
      .get();

    if (snapshot.empty) {
      return { success: true, count: 0 };
    }

    const batch = adminDb.batch();
    const now = Timestamp.now();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const reviewId = data?.reviewId;
      if (reviewId) {
        await adminDb.collection('peer-reviews').doc(reviewId).delete().catch(() => {});
        await adminDb.collection('reviews').doc(reviewId).delete().catch(() => {});
      }
      batch.update(doc.ref, {
        status: 'pending',
        reviewId: FieldValue.delete(),
        updatedAt: now,
      });
    }

    await batch.commit();
    revalidatePath('/admin/assignments');
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error(`Error clearing all submitted reviews for cycle ${reviewCycleId}:`, error);
    throw new Error('Failed to clear submitted reviews.');
  }
}

