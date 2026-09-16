'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireUserSession } from '@/lib/auth';
import type { Review, ReviewCycle, PeerReviewAssignment, Questionnaire } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

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

export interface UserDashboardData {
  selfReviews: Review[];
  peerReviews: Review[];
  cycles: ReviewCycle[];
  pendingCount: number;
  completedCount: number;
  overdueCount: number;
  completionRate: number;
}

export async function getUserDashboardDataAction(): Promise<UserDashboardData> {
  const session = await requireUserSession();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error('Unauthorized: User ID not found in session.');
  }

  // 1. Fetch active review cycles
  let activeCycles: ReviewCycle[] = [];
  try {
    const cyclesSnap = await adminDb.collection('review-cycles').where('status', '==', 'active').get();
    activeCycles = cyclesSnap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        selfReviewQuestionnaireId: data.selfReviewQuestionnaireId || null,
        peerReviewQuestionnaireId: data.peerReviewQuestionnaireId || null,
        startDate: toISOString(data.startDate),
        endDate: toISOString(data.endDate),
        createdAt: toISOString(data.createdAt),
        updatedAt: toISOString(data.updatedAt),
      } as ReviewCycle;
    });
  } catch (err) {
    console.error('Error fetching active review cycles for dashboard:', err);
    activeCycles = [];
  }

  // 2. Fetch existing self-reviews for this user
  let existingSelfReviews: Review[] = [];
  try {
    const selfReviewsSnap = await adminDb.collection('reviews')
      .where('type', '==', 'self')
      .where('reviewee.id', '==', userId)
      .get();

    existingSelfReviews = selfReviewsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: toISOString(data.createdAt),
        updatedAt: toISOString(data.updatedAt),
      } as Review;
    });
  } catch (err) {
    console.error('Error fetching user self-reviews:', err);
  }

  // 3. For each active cycle where user is a participant, create/match self-review task
  const userCycles = activeCycles.filter(c => Array.isArray(c.participantIds) && c.participantIds.includes(userId));
  const selfReviews: Review[] = [];

  for (const cycle of userCycles) {
    const matched = existingSelfReviews.find(r => r.reviewCycleId === cycle.id);
    if (matched) {
      selfReviews.push({
        ...matched,
        dueDate: cycle.endDate || matched.dueDate,
      });
    } else {
      // Create a pending self-review task for this cycle using the cycle's defined selfReviewQuestionnaireId
      selfReviews.push({
        id: `self-task-${cycle.id}`,
        title: `${cycle.name} - Self-Review`,
        type: 'self',
        status: 'pending_submission',
        dueDate: cycle.endDate,
        reviewCycleId: cycle.id,
        questionnaireId: cycle.selfReviewQuestionnaireId || '',
        questions: [],
        answers: [],
        reviewee: {
          id: userId,
          name: session.user.name || 'User',
          email: session.user.email || '',
          avatarUrl: session.user.image || '',
          role: session.user.role || 'employee',
        },
        createdAt: cycle.createdAt,
        updatedAt: cycle.updatedAt,
      });
    }
  }

  // Also include any standalone self-reviews that are not linked to the above active cycles
  for (const review of existingSelfReviews) {
    if (!selfReviews.some(r => r.id === review.id)) {
      selfReviews.push(review);
    }
  }

  // 4. Fetch peer review assignments where current user is the reviewer
  const peerReviews: Review[] = [];
  try {
    const assignmentsSnap = await adminDb.collection('peer-review-assignments')
      .where('reviewerId', '==', userId)
      .get();

    const assignments = assignmentsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: toISOString(data.createdAt),
        updatedAt: toISOString(data.updatedAt),
      } as PeerReviewAssignment;
    });

    for (const assign of assignments) {
      const matchedCycle = activeCycles.find(c => c.id === assign.reviewCycleId);
      const effectiveQuestionnaireId = assign.questionnaireId || matchedCycle?.peerReviewQuestionnaireId || '';

      let reviewStatus: Review['status'] = 'pending_submission';
      if (assign.status === 'completed') {
        reviewStatus = 'completed';
      } else if (assign.status === 'in_progress') {
        reviewStatus = 'draft';
      } else {
        reviewStatus = 'pending_submission';
      }

      peerReviews.push({
        id: assign.id, // Links directly to assignment page /reviews/peer/[assignmentId]
        assignmentId: assign.id,
        title: `Peer Review for ${assign.revieweeName}`,
        type: 'peer',
        status: reviewStatus,
        dueDate: assign.dueDate || matchedCycle?.endDate || '',
        reviewCycleId: assign.reviewCycleId,
        questionnaireId: effectiveQuestionnaireId,
        questions: [],
        answers: [],
        reviewee: {
          id: assign.revieweeId,
          name: assign.revieweeName,
          avatarUrl: assign.revieweeAvatarUrl || '',
          email: '',
          role: 'employee',
        },
        reviewer: {
          id: assign.reviewerId,
          name: assign.reviewerName,
          avatarUrl: assign.reviewerAvatarUrl || '',
          email: session.user.email || '',
          role: session.user.role || 'employee',
        },
        createdAt: assign.createdAt,
        updatedAt: assign.updatedAt,
      });
    }
  } catch (err) {
    console.error('Error fetching peer assignments for dashboard:', err);
  }

  // 5. Compute KPI summary metrics
  const allReviews = [...selfReviews, ...peerReviews];
  const now = new Date();
  const pendingCount = allReviews.filter(r => r.status === 'draft' || r.status === 'pending_submission').length;
  const completedCount = allReviews.filter(r => r.status === 'submitted' || r.status === 'completed').length;
  const overdueCount = allReviews.filter(r => r.dueDate && new Date(r.dueDate) < now && r.status !== 'completed' && r.status !== 'submitted').length;
  const totalCount = allReviews.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    selfReviews,
    peerReviews,
    cycles: activeCycles,
    pendingCount,
    completedCount,
    overdueCount,
    completionRate,
  };
}
