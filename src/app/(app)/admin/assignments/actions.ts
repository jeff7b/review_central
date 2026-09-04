
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireAdminSession } from '@/lib/auth';
import type { PeerReviewAssignment, User } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';
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
