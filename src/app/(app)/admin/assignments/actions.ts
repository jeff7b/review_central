
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import type { PeerReviewAssignment, User } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';

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
  const assignmentsRef = adminDb.collection('peer-review-assignments');
  const now = Timestamp.now();

  const assignmentPayload = {
    reviewCycleId: data.reviewCycleId,
    revieweeId: data.reviewee.id,
    revieweeName: data.reviewee.name,
    revieweeAvatarUrl: data.reviewee.avatarUrl || '',
    reviewerId: data.reviewer.id,
    reviewerName: data.reviewer.name,
    reviewerAvatarUrl: data.reviewer.avatarUrl || '',
    questionnaireId: data.questionnaireId,
    status: data.status,
    dueDate: data.dueDate,
    updatedAt: now,
  };

  if (data.id) {
    // Update existing assignment
    const docRef = assignmentsRef.doc(data.id);
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
  if (!reviewCycleId) return [];
  try {
    const snapshot = await adminDb.collection('peer-review-assignments')
      .where('reviewCycleId', '==', reviewCycleId)
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
  try {
    await adminDb.collection('peer-review-assignments').doc(assignmentId).delete();
    revalidatePath('/admin/assignments');
  } catch (error) {
    console.error('Error deleting assignment:', error);
    throw new Error('Failed to delete assignment.');
  }
}
