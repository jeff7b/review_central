'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireUserSession } from '@/lib/auth';
import type { Review, Questionnaire, ReviewCycle, PeerReviewAssignment, Answer, User } from '@/types';
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

/**
 * Fetches review data and questions for a self-review by cycleId or reviewId.
 */
export async function getSelfReviewDataAction(params: {
  cycleId?: string;
  reviewId?: string;
}): Promise<{
  reviewCycle: ReviewCycle | null;
  questionnaire: Questionnaire | null;
  existingReview: Review | null;
}> {
  const session = await requireUserSession();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error('Unauthorized: User ID not found.');
  }

  let reviewCycle: ReviewCycle | null = null;
  let questionnaire: Questionnaire | null = null;
  let existingReview: Review | null = null;

  // If reviewId is provided, load the existing review
  if (params.reviewId) {
    const reviewDoc = await adminDb.collection('reviews').doc(params.reviewId).get();
    if (reviewDoc.exists) {
      const data = reviewDoc.data()!;
      existingReview = {
        ...data,
        id: reviewDoc.id,
        createdAt: toISOString(data.createdAt),
        updatedAt: toISOString(data.updatedAt),
      } as Review;

      if (existingReview.reviewCycleId) {
        params.cycleId = existingReview.reviewCycleId;
      }
      if (existingReview.questionnaireId) {
        const qDoc = await adminDb.collection('questionnaires').doc(existingReview.questionnaireId).get();
        if (qDoc.exists) {
          const qData = qDoc.data()!;
          questionnaire = {
            ...qData,
            id: qDoc.id,
            createdAt: toISOString(qData.createdAt),
            updatedAt: toISOString(qData.updatedAt),
          } as Questionnaire;
        }
      }
    }
  }

  // If cycleId is provided or found, load the cycle
  if (params.cycleId) {
    const cycleDoc = await adminDb.collection('review-cycles').doc(params.cycleId).get();
    if (cycleDoc.exists) {
      const cData = cycleDoc.data()!;
      reviewCycle = {
        ...cData,
        id: cycleDoc.id,
        createdAt: toISOString(cData.createdAt),
        updatedAt: toISOString(cData.updatedAt),
        startDate: toISOString(cData.startDate),
        endDate: toISOString(cData.endDate),
      } as ReviewCycle;

      // If existingReview not yet found, check if a review exists for this user in this cycle
      if (!existingReview) {
        const existingSnap = await adminDb.collection('reviews')
          .where('reviewCycleId', '==', reviewCycle.id)
          .where('reviewee.id', '==', userId)
          .where('type', '==', 'self')
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          const d = existingSnap.docs[0];
          const data = d.data();
          existingReview = {
            ...data,
            id: d.id,
            createdAt: toISOString(data.createdAt),
            updatedAt: toISOString(data.updatedAt),
          } as Review;
        }
      }

      // If questionnaire not yet loaded, load from cycle's selfReviewQuestionnaireId
      if (!questionnaire && reviewCycle.selfReviewQuestionnaireId) {
        const qDoc = await adminDb.collection('questionnaires').doc(reviewCycle.selfReviewQuestionnaireId).get();
        if (qDoc.exists) {
          const qData = qDoc.data()!;
          questionnaire = {
            ...qData,
            id: qDoc.id,
            createdAt: toISOString(qData.createdAt),
            updatedAt: toISOString(qData.updatedAt),
          } as Questionnaire;
        }
      }
    }
  }

  // Fallback: if no questionnaire loaded, attempt to find an active self-review questionnaire
  if (!questionnaire) {
    const qSnap = await adminDb.collection('questionnaires')
      .where('isActive', '==', true)
      .where('type', '==', 'self')
      .limit(1)
      .get();

    if (!qSnap.empty) {
      const qDoc = qSnap.docs[0];
      const qData = qDoc.data();
      questionnaire = {
        ...qData,
        id: qDoc.id,
        createdAt: toISOString(qData.createdAt),
        updatedAt: toISOString(qData.updatedAt),
      } as Questionnaire;
    }
  }

  return {
    reviewCycle,
    questionnaire,
    existingReview,
  };
}

const SaveSelfReviewSchema = z.object({
  reviewId: z.string().optional(),
  reviewCycleId: z.string().optional().nullable(),
  questionnaireId: z.string().min(1, 'Questionnaire is required'),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answerText: z.string(),
    })
  ),
  isDraft: z.boolean(),
});

/**
 * Saves or submits a self-review.
 */
export async function saveSelfReviewAction(input: z.infer<typeof SaveSelfReviewSchema>) {
  const session = await requireUserSession();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error('Unauthorized: User ID not found.');
  }
  const validated = SaveSelfReviewSchema.parse(input);
  const now = Timestamp.now();

  // Retrieve questionnaire details
  let questions = [];
  const qDoc = await adminDb.collection('questionnaires').doc(validated.questionnaireId).get();
  if (qDoc.exists) {
    questions = qDoc.data()?.questions || [];
  }

  let cycleTitle = 'Self-Review';
  let dueDate = '';
  if (validated.reviewCycleId) {
    const cDoc = await adminDb.collection('review-cycles').doc(validated.reviewCycleId).get();
    if (cDoc.exists) {
      const cData = cDoc.data()!;
      cycleTitle = `${cData.name} - Self-Review`;
      dueDate = toISOString(cData.endDate);
    }
  }

  const reviewPayload = {
    title: cycleTitle,
    type: 'self' as const,
    status: (validated.isDraft ? 'draft' : 'submitted') as Review['status'],
    dueDate,
    reviewCycleId: validated.reviewCycleId || null,
    questionnaireId: validated.questionnaireId,
    questions,
    answers: validated.answers,
    reviewee: {
      id: userId,
      name: session.user.name || 'User',
      email: session.user.email || '',
      avatarUrl: session.user.image || '',
      role: session.user.role || 'employee',
    },
    updatedAt: now,
  };

  const reviewsRef = adminDb.collection('reviews');
  let reviewId = validated.reviewId;

  if (reviewId) {
    await reviewsRef.doc(reviewId).update(reviewPayload);
  } else {
    // Check if user already has a review for this cycle to avoid duplicates
    if (validated.reviewCycleId) {
      const existing = await reviewsRef
        .where('reviewCycleId', '==', validated.reviewCycleId)
        .where('reviewee.id', '==', userId)
        .where('type', '==', 'self')
        .limit(1)
        .get();

      if (!existing.empty) {
        reviewId = existing.docs[0].id;
        await reviewsRef.doc(reviewId).update(reviewPayload);
      } else {
        const newDoc = reviewsRef.doc();
        reviewId = newDoc.id;
        await newDoc.set({
          ...reviewPayload,
          id: reviewId,
          createdAt: now,
        });
      }
    } else {
      const newDoc = reviewsRef.doc();
      reviewId = newDoc.id;
      await newDoc.set({
        ...reviewPayload,
        id: reviewId,
        createdAt: now,
      });
    }
  }

  revalidatePath('/dashboard');
  return { success: true, reviewId };
}

/**
 * Fetches peer review data and assignment details by assignment ID.
 */
export async function getPeerReviewDataAction(assignmentId: string): Promise<{
  assignment: PeerReviewAssignment | null;
  reviewCycle: ReviewCycle | null;
  questionnaire: Questionnaire | null;
  existingReview: Review | null;
}> {
  const session = await requireUserSession();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error('Unauthorized: User ID not found.');
  }
  const validatedId = z.string().min(1).parse(assignmentId);

  const assignDoc = await adminDb.collection('peer-review-assignments').doc(validatedId).get();
  if (!assignDoc.exists) {
    return { assignment: null, reviewCycle: null, questionnaire: null, existingReview: null };
  }

  const assignData = assignDoc.data()!;
  const assignment: PeerReviewAssignment = {
    ...assignData,
    id: assignDoc.id,
    createdAt: toISOString(assignData.createdAt),
    updatedAt: toISOString(assignData.updatedAt),
  } as PeerReviewAssignment;

  // Check authorization: reviewer or admin
  if (assignment.reviewerId !== userId && session.user.role !== 'admin') {
    throw new Error('Unauthorized: You are not assigned to this peer review.');
  }

  let reviewCycle: ReviewCycle | null = null;
  if (assignment.reviewCycleId) {
    const cycleDoc = await adminDb.collection('review-cycles').doc(assignment.reviewCycleId).get();
    if (cycleDoc.exists) {
      const cData = cycleDoc.data()!;
      reviewCycle = {
        ...cData,
        id: cycleDoc.id,
        createdAt: toISOString(cData.createdAt),
        updatedAt: toISOString(cData.updatedAt),
        startDate: toISOString(cData.startDate),
        endDate: toISOString(cData.endDate),
      } as ReviewCycle;
    }
  }

  // Load questionnaire
  let questionnaire: Questionnaire | null = null;
  const targetQId = assignment.questionnaireId || reviewCycle?.peerReviewQuestionnaireId;
  if (targetQId) {
    const qDoc = await adminDb.collection('questionnaires').doc(targetQId).get();
    if (qDoc.exists) {
      const qData = qDoc.data()!;
      questionnaire = {
        ...qData,
        id: qDoc.id,
        createdAt: toISOString(qData.createdAt),
        updatedAt: toISOString(qData.updatedAt),
      } as Questionnaire;
    }
  }

  // Fallback if questionnaire not found: active peer questionnaire
  if (!questionnaire) {
    const qSnap = await adminDb.collection('questionnaires')
      .where('isActive', '==', true)
      .where('type', '==', 'peer')
      .limit(1)
      .get();

    if (!qSnap.empty) {
      const qDoc = qSnap.docs[0];
      const qData = qDoc.data();
      questionnaire = {
        ...qData,
        id: qDoc.id,
        createdAt: toISOString(qData.createdAt),
        updatedAt: toISOString(qData.updatedAt),
      } as Questionnaire;
    }
  }

  // Load existing review if available
  let existingReview: Review | null = null;
  if (assignment.reviewId) {
    const rDoc = await adminDb.collection('reviews').doc(assignment.reviewId).get();
    if (rDoc.exists) {
      const rData = rDoc.data()!;
      existingReview = {
        ...rData,
        id: rDoc.id,
        createdAt: toISOString(rData.createdAt),
        updatedAt: toISOString(rData.updatedAt),
      } as Review;
    }
  }

  return {
    assignment,
    reviewCycle,
    questionnaire,
    existingReview,
  };
}

const SavePeerReviewSchema = z.object({
  assignmentId: z.string().min(1, 'Assignment ID is required'),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answerText: z.string(),
    })
  ),
  isDraft: z.boolean(),
});

/**
 * Saves or submits a peer review and updates the assignment.
 */
export async function savePeerReviewAction(input: z.infer<typeof SavePeerReviewSchema>) {
  const session = await requireUserSession();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error('Unauthorized: User ID not found.');
  }
  const validated = SavePeerReviewSchema.parse(input);
  const now = Timestamp.now();

  const assignRef = adminDb.collection('peer-review-assignments').doc(validated.assignmentId);
  const assignDoc = await assignRef.get();
  if (!assignDoc.exists) {
    throw new Error('Assignment not found.');
  }

  const assignment = assignDoc.data()!;
  if (assignment.reviewerId !== userId && session.user.role !== 'admin') {
    throw new Error('Unauthorized.');
  }

  // Get questionnaire questions
  let questions = [];
  const qId = assignment.questionnaireId;
  if (qId) {
    const qDoc = await adminDb.collection('questionnaires').doc(qId).get();
    if (qDoc.exists) {
      questions = qDoc.data()?.questions || [];
    }
  }

  const reviewPayload = {
    title: `Peer Review for ${assignment.revieweeName}`,
    type: 'peer' as const,
    status: (validated.isDraft ? 'draft' : 'completed') as Review['status'],
    dueDate: assignment.dueDate || '',
    reviewCycleId: assignment.reviewCycleId || null,
    assignmentId: validated.assignmentId,
    questionnaireId: assignment.questionnaireId || '',
    questions,
    answers: validated.answers,
    reviewee: {
      id: assignment.revieweeId,
      name: assignment.revieweeName,
      avatarUrl: assignment.revieweeAvatarUrl || '',
      email: '',
      role: 'employee',
    },
    reviewer: {
      id: assignment.reviewerId,
      name: assignment.reviewerName,
      avatarUrl: assignment.reviewerAvatarUrl || '',
      email: session.user.email || '',
      role: session.user.role || 'employee',
    },
    updatedAt: now,
  };

  const reviewsRef = adminDb.collection('reviews');
  let reviewId = assignment.reviewId;

  if (reviewId) {
    await reviewsRef.doc(reviewId).update(reviewPayload);
  } else {
    const newDoc = reviewsRef.doc();
    reviewId = newDoc.id;
    await newDoc.set({
      ...reviewPayload,
      id: reviewId,
      createdAt: now,
    });
  }

  // Update assignment
  await assignRef.update({
    status: validated.isDraft ? 'in_progress' : 'completed',
    reviewId,
    updatedAt: now,
  });

  revalidatePath('/dashboard');
  revalidatePath('/admin/assignments');
  return { success: true, reviewId };
}
