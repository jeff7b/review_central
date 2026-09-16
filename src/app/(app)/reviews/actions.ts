'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getCurrentAppUser, requireUserSession } from '@/lib/auth';
import type { Review, Answer, Question, Questionnaire, PeerReviewAssignment, ReviewCycle } from '@/types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
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

const defaultSelfQuestions: Question[] = [
  { id: 'q1', text: 'What were your major accomplishments in the last review period?', order: 1 },
  { id: 'q2', text: 'What are some areas where you faced challenges, and how did you address them?', order: 2 },
  { id: 'q3', text: 'What are your key strengths, and how did you leverage them?', order: 3 },
  { id: 'q4', text: 'What are your areas for development, and what steps will you take to improve?', order: 4 },
  { id: 'q5', text: 'What are your goals for the next review period?', order: 5 },
];

const defaultPeerQuestions: Question[] = [
  { id: 'pq1', text: 'How has this peer contributed to team goals?', order: 1 },
  { id: 'pq2', text: 'Describe a situation where this peer demonstrated strong collaboration skills.', order: 2 },
  { id: 'pq3', text: "What are this peer's key strengths from your perspective?", order: 3 },
  { id: 'pq4', text: 'In what areas could this peer potentially improve or develop further?', order: 4 },
  { id: 'pq5', text: 'Provide any additional feedback you think would be helpful.', order: 5 },
];

/**
 * Loads assignment details, reviewee info, and questionnaire questions for completing a peer review.
 */
export async function getPeerReviewAssignmentAction(assignmentId: string) {
  await requireUserSession();
  const assignmentRef = adminDb.collection('peer-review-assignments').doc(assignmentId);
  const assignmentDoc = await assignmentRef.get();

  if (!assignmentDoc.exists) {
    throw new Error('Assignment not found.');
  }

  const assignmentData = assignmentDoc.data()!;
  const assignment: PeerReviewAssignment = {
    id: assignmentDoc.id,
    reviewCycleId: assignmentData.reviewCycleId,
    revieweeId: assignmentData.revieweeId,
    revieweeName: assignmentData.revieweeName,
    revieweeAvatarUrl: assignmentData.revieweeAvatarUrl,
    reviewerId: assignmentData.reviewerId,
    reviewerName: assignmentData.reviewerName,
    reviewerAvatarUrl: assignmentData.reviewerAvatarUrl,
    questionnaireId: assignmentData.questionnaireId,
    status: assignmentData.status,
    dueDate: toISOString(assignmentData.dueDate),
    reviewId: assignmentData.reviewId,
    createdAt: toISOString(assignmentData.createdAt),
    updatedAt: toISOString(assignmentData.updatedAt),
  };

  // Fetch questionnaire questions
  let questions: Question[] = defaultPeerQuestions;
  let questionnaireName = 'Peer Review Questionnaire';

  if (assignment.questionnaireId) {
    const qDoc = await adminDb.collection('questionnaires').doc(assignment.questionnaireId).get().catch(() => null);
    if (qDoc && qDoc.exists) {
      const qData = qDoc.data();
      if (qData?.questions && qData.questions.length > 0) {
        questions = qData.questions;
      }
      if (qData?.name) {
        questionnaireName = qData.name;
      }
    }
  }

  // Fetch existing answers if previously saved
  let initialAnswers: Answer[] = [];
  if (assignment.reviewId) {
    const rDoc = await adminDb.collection('peer-reviews').doc(assignment.reviewId).get().catch(() => null);
    if (rDoc && rDoc.exists) {
      initialAnswers = rDoc.data()?.answers || [];
    }
  }

  return {
    assignment,
    questions,
    questionnaireName,
    initialAnswers,
  };
}

/**
 * Submits or saves draft for a peer review assignment.
 */
export async function submitPeerReviewAction(params: {
  assignmentId: string;
  answers: Answer[];
  isDraft: boolean;
}) {
  const currentUser = await getCurrentAppUser();
  const assignmentRef = adminDb.collection('peer-review-assignments').doc(params.assignmentId);
  const assignmentDoc = await assignmentRef.get();

  if (!assignmentDoc.exists) {
    throw new Error('Assignment not found.');
  }

  const assignment = assignmentDoc.data()!;
  // Ensure the current user is authorized to submit this review
  if (assignment.reviewerId !== currentUser.id && currentUser.role !== 'admin') {
    throw new Error('You are not authorized to submit this peer review.');
  }

  const now = Timestamp.now();
  const peerReviewsRef = adminDb.collection('peer-reviews');

  let reviewId = assignment.reviewId;
  const reviewPayload = {
    assignmentId: params.assignmentId,
    reviewCycleId: assignment.reviewCycleId,
    reviewerId: assignment.reviewerId,
    reviewerName: assignment.reviewerName,
    revieweeId: assignment.revieweeId,
    revieweeName: assignment.revieweeName,
    questionnaireId: assignment.questionnaireId,
    type: 'peer' as const,
    status: params.isDraft ? 'draft' : 'completed',
    answers: params.answers,
    updatedAt: now,
  };

  if (reviewId) {
    await peerReviewsRef.doc(reviewId).set(
      {
        ...reviewPayload,
        updatedAt: now,
      },
      { merge: true }
    );
  } else {
    const newDoc = peerReviewsRef.doc();
    reviewId = newDoc.id;
    await newDoc.set({
      ...reviewPayload,
      id: reviewId,
      createdAt: now,
    });
  }

  // Update assignment status
  await assignmentRef.update({
    status: params.isDraft ? 'in_progress' : 'completed',
    reviewId,
    updatedAt: now,
  });

  revalidatePath('/dashboard');
  revalidatePath('/team-dashboard');
  revalidatePath('/admin/assignments');

  return { success: true, reviewId };
}

/**
 * Context for starting a new self-review.
 */
export async function getNewSelfReviewContextAction(cycleId?: string) {
  const currentUser = await getCurrentAppUser();

  // Fetch active self questionnaire
  const questionnairesSnap = await adminDb.collection('questionnaires')
    .where('type', '==', 'self')
    .where('isActive', '==', true)
    .limit(1)
    .get()
    .catch(() => null);

  let questionnaire: Questionnaire | null = null;
  let questions: Question[] = defaultSelfQuestions;

  if (questionnairesSnap && !questionnairesSnap.empty) {
    const doc = questionnairesSnap.docs[0];
    const data = doc.data();
    questionnaire = {
      id: doc.id,
      templateId: data.templateId,
      version: data.version,
      name: data.name,
      description: data.description,
      type: 'self',
      questions: data.questions,
      isActive: data.isActive,
      createdAt: toISOString(data.createdAt),
      updatedAt: toISOString(data.updatedAt),
    };
    if (data.questions && data.questions.length > 0) {
      questions = data.questions;
    }
  }

  // Fetch active cycles
  const cyclesSnap = await adminDb.collection('review-cycles')
    .where('status', '==', 'active')
    .get()
    .catch(() => null);

  let activeCycle: ReviewCycle | null = null;
  if (cyclesSnap && !cyclesSnap.empty) {
    if (cycleId) {
      const found = cyclesSnap.docs.find(d => d.id === cycleId);
      if (found) {
        const d = found.data();
        activeCycle = { id: found.id, ...d, createdAt: toISOString(d.createdAt), updatedAt: toISOString(d.updatedAt), startDate: toISOString(d.startDate), endDate: toISOString(d.endDate) } as ReviewCycle;
      }
    }
    if (!activeCycle) {
      const d = cyclesSnap.docs[0].data();
      activeCycle = { id: cyclesSnap.docs[0].id, ...d, createdAt: toISOString(d.createdAt), updatedAt: toISOString(d.updatedAt), startDate: toISOString(d.startDate), endDate: toISOString(d.endDate) } as ReviewCycle;
    }
  }

  return {
    currentUser,
    questionnaire,
    questions,
    activeCycle,
  };
}

/**
 * Loads an existing self-review for editing.
 */
export async function getSelfReviewAction(reviewId: string) {
  const currentUser = await getCurrentAppUser();

  // If this is an active cycle invitation ID (starts with cycle-invitation-)
  if (reviewId.startsWith('cycle-invitation-')) {
    const cycleId = reviewId.replace('cycle-invitation-', '');
    const context = await getNewSelfReviewContextAction(cycleId);
    return {
      review: {
        id: reviewId,
        title: context.activeCycle ? `${context.activeCycle.name} Self-Review` : 'Self-Review',
        type: 'self' as const,
        status: 'draft' as const,
        dueDate: context.activeCycle?.endDate,
        questionnaireId: context.questionnaire?.id || '',
        questions: context.questions,
        answers: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  const reviewDoc = await adminDb.collection('reviews').doc(reviewId).get();
  if (!reviewDoc.exists) {
    throw new Error('Self-review not found.');
  }

  const data = reviewDoc.data()!;
  if (data.revieweeId !== currentUser.id && data.userId !== currentUser.id && currentUser.role !== 'admin') {
    throw new Error('Unauthorized to view this review.');
  }

  const questions = data.questions && data.questions.length > 0 ? data.questions : defaultSelfQuestions;

  return {
    review: {
      id: reviewDoc.id,
      title: data.title || 'Self-Review',
      type: 'self' as const,
      status: data.status || 'draft',
      dueDate: data.dueDate ? toISOString(data.dueDate) : undefined,
      questionnaireId: data.questionnaireId || '',
      questions,
      answers: data.answers || [],
      createdAt: toISOString(data.createdAt),
      updatedAt: toISOString(data.updatedAt),
    } as Review,
  };
}

/**
 * Creates or updates a self-review in the 'reviews' collection.
 */
export async function submitSelfReviewAction(params: {
  id?: string;
  title?: string;
  questionnaireId?: string;
  questions: Question[];
  answers: Answer[];
  isDraft: boolean;
  reviewCycleId?: string;
  dueDate?: string;
}) {
  const currentUser = await getCurrentAppUser();
  const now = Timestamp.now();
  const reviewsRef = adminDb.collection('reviews');

  const isInvitation = params.id?.startsWith('cycle-invitation-');
  const reviewId = params.id && !isInvitation ? params.id : reviewsRef.doc().id;

  const title = params.title || 'Self-Review';
  const status = params.isDraft ? 'draft' : 'submitted';

  const payload = {
    id: reviewId,
    title,
    type: 'self',
    status,
    revieweeId: currentUser.id,
    reviewerId: currentUser.id,
    revieweeName: currentUser.name,
    questionnaireId: params.questionnaireId || '',
    questions: params.questions,
    answers: params.answers,
    reviewCycleId: params.reviewCycleId || (isInvitation ? params.id?.replace('cycle-invitation-', '') : null),
    dueDate: params.dueDate || null,
    updatedAt: now,
  };

  const docRef = reviewsRef.doc(reviewId);
  const existing = await docRef.get();

  if (existing.exists) {
    await docRef.update(payload);
  } else {
    await docRef.set({
      ...payload,
      createdAt: now,
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/team-dashboard');

  return { success: true, reviewId };
}
