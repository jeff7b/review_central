'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getCurrentAppUser } from '@/lib/auth';
import type { Review, PersonalNote, HistoricalEvaluation, PeerReviewAssignment, ReviewCycle, User } from '@/types';
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

const SaveNoteSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().trim().max(5000).default(''),
  category: z.enum(['achievement', 'goal', 'meeting', 'reflection']),
  date: z.string().min(1).default(() => new Date().toISOString().split('T')[0]),
});

export interface DashboardData {
  selfReviews: Review[];
  peerReviewsAssigned: Review[];
  notes: PersonalNote[];
  feedbackHistory: HistoricalEvaluation[];
  currentUser: User;
}

/**
 * Fetches all dashboard data for the authenticated user from live Firestore collections.
 * Uses the Review Cycle's defined Self and Peer Review questionnaires to build user review tasks.
 */
export async function getDashboardDataAction(): Promise<DashboardData> {
  const currentUser = await getCurrentAppUser();
  const userId = currentUser.id;

  try {
    // 1. Fetch user's self reviews from 'reviews' collection
    const selfReviewsSnap = await adminDb.collection('reviews')
      .where('type', '==', 'self')
      .where('revieweeId', '==', userId)
      .get()
      .catch(() => null);

    const userSelfReviews: Review[] = [];
    if (selfReviewsSnap && !selfReviewsSnap.empty) {
      selfReviewsSnap.docs.forEach(doc => {
        const d = doc.data();
        userSelfReviews.push({
          id: doc.id,
          title: d.title || 'Self-Review',
          type: 'self',
          status: d.status || 'draft',
          dueDate: d.dueDate ? toISOString(d.dueDate) : undefined,
          questionnaireId: d.questionnaireId || '',
          reviewCycleId: d.reviewCycleId || undefined,
          questions: d.questions || [],
          answers: d.answers || [],
          createdAt: toISOString(d.createdAt),
          updatedAt: toISOString(d.updatedAt),
        });
      });
    }

    // Check for active cycles where user is participant but has not started self-review
    const activeCyclesSnap = await adminDb.collection('review-cycles')
      .where('status', '==', 'active')
      .get()
      .catch(() => null);

    const activeCyclesMap = new Map<string, ReviewCycle>();

    if (activeCyclesSnap && !activeCyclesSnap.empty) {
      for (const cycleDoc of activeCyclesSnap.docs) {
        const cycle = {
          ...cycleDoc.data(),
          id: cycleDoc.id,
        } as ReviewCycle;
        activeCyclesMap.set(cycleDoc.id, cycle);

        const isParticipant = cycle.participantIds && cycle.participantIds.includes(userId);
        if (isParticipant) {
          const alreadyHasReview = userSelfReviews.some(
            r => r.reviewCycleId === cycleDoc.id || r.title.includes(cycle.name)
          );
          if (!alreadyHasReview) {
            // Task generated using the cycle's defined selfReviewQuestionnaireId
            userSelfReviews.push({
              id: `cycle-invitation-${cycleDoc.id}`,
              title: `${cycle.name} Self-Review`,
              type: 'self',
              status: 'pending_submission',
              dueDate: toISOString(cycle.endDate),
              questionnaireId: cycle.selfReviewQuestionnaireId || '',
              reviewCycleId: cycleDoc.id,
              questions: [],
              answers: [],
              createdAt: toISOString(cycle.createdAt),
              updatedAt: toISOString(cycle.updatedAt),
            });
          }
        }
      }
    }

    // 2. Fetch assigned peer reviews from 'peer-review-assignments'
    const assignedPeerSnap = await adminDb.collection('peer-review-assignments')
      .where('reviewerId', '==', userId)
      .get()
      .catch(() => null);

    const peerReviewsAssigned: Review[] = [];
    if (assignedPeerSnap && !assignedPeerSnap.empty) {
      assignedPeerSnap.docs.forEach(doc => {
        const a = doc.data() as PeerReviewAssignment;
        let reviewStatus: Review['status'] = 'pending_submission';
        if (a.status === 'completed') reviewStatus = 'completed';
        else if (a.status === 'in_progress') reviewStatus = 'draft';

        const cycle = a.reviewCycleId ? activeCyclesMap.get(a.reviewCycleId) : undefined;
        const effectiveQuestionnaireId = a.questionnaireId || cycle?.peerReviewQuestionnaireId || '';

        peerReviewsAssigned.push({
          id: doc.id,
          assignmentId: doc.id,
          title: `Peer Review for ${a.revieweeName}`,
          type: 'peer',
          status: reviewStatus,
          dueDate: a.dueDate ? toISOString(a.dueDate) : (cycle ? toISOString(cycle.endDate) : undefined),
          reviewCycleId: a.reviewCycleId,
          reviewee: {
            id: a.revieweeId,
            name: a.revieweeName,
            email: '',
            role: 'employee',
            avatarUrl: a.revieweeAvatarUrl,
          },
          questionnaireId: effectiveQuestionnaireId,
          questions: [],
          createdAt: toISOString(a.createdAt),
          updatedAt: toISOString(a.updatedAt),
        });
      });
    }

    // 3. Fetch user's personal notes from 'personal-notes'
    const notesSnap = await adminDb.collection('personal-notes')
      .where('userId', '==', userId)
      .get()
      .catch(() => null);

    const notes: PersonalNote[] = [];
    if (notesSnap && !notesSnap.empty) {
      notesSnap.docs.forEach(doc => {
        const d = doc.data();
        notes.push({
          id: doc.id,
          userId: d.userId,
          title: d.title,
          content: d.content || '',
          category: d.category || 'achievement',
          date: d.date || new Date().toISOString().split('T')[0],
          createdAt: toISOString(d.createdAt),
          updatedAt: toISOString(d.updatedAt),
        });
      });
      // Sort notes by date descending
      notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // 4. Fetch feedback history (completed peer reviews where user is reviewee)
    const completedAssignmentsForUserSnap = await adminDb.collection('peer-review-assignments')
      .where('revieweeId', '==', userId)
      .where('status', '==', 'completed')
      .get()
      .catch(() => null);

    const feedbackHistory: HistoricalEvaluation[] = [];
    if (completedAssignmentsForUserSnap && !completedAssignmentsForUserSnap.empty) {
      for (const aDoc of completedAssignmentsForUserSnap.docs) {
        const a = aDoc.data() as PeerReviewAssignment;
        feedbackHistory.push({
          id: `eval-${aDoc.id}`,
          cycleTitle: `Peer Evaluation from ${a.reviewerName}`,
          period: 'Review Cycle',
          completedDate: toISOString(a.updatedAt),
          type: '360 Peer Evaluation',
          overallRating: 'Completed',
          ratingTier: 'meets',
          reviewer: a.reviewerName,
          reviewerRole: 'Peer Evaluator',
          summary: `Peer evaluation completed by ${a.reviewerName}.`,
          keyStrengths: ['Teamwork', 'Collaboration'],
          growthAreas: ['Continued Knowledge Sharing'],
        });
      }
    }

    // Also check dedicated 'evaluations' collection if present
    const evaluationsSnap = await adminDb.collection('evaluations')
      .where('revieweeId', '==', userId)
      .get()
      .catch(() => null);

    if (evaluationsSnap && !evaluationsSnap.empty) {
      evaluationsSnap.docs.forEach(doc => {
        const d = doc.data();
        feedbackHistory.push({
          id: doc.id,
          cycleTitle: d.cycleTitle || 'Performance Review Cycle',
          period: d.period || '',
          completedDate: toISOString(d.completedDate || d.updatedAt),
          type: d.type || 'Annual Performance Review',
          overallRating: d.overallRating || 'Meets Expectations',
          ratingTier: d.ratingTier || 'meets',
          reviewer: d.reviewer || 'Supervisor',
          reviewerRole: d.reviewerRole || 'Reviewer',
          summary: d.summary || '',
          keyStrengths: d.keyStrengths || [],
          growthAreas: d.growthAreas || [],
        });
      });
    }

    return {
      selfReviews: userSelfReviews,
      peerReviewsAssigned,
      notes,
      feedbackHistory,
      currentUser,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      selfReviews: [],
      peerReviewsAssigned: [],
      notes: [],
      feedbackHistory: [],
      currentUser,
    };
  }
}

/**
 * Backward compatibility alias for getUserDashboardDataAction
 */
export async function getUserDashboardDataAction() {
  const data = await getDashboardDataAction();
  const allReviews = [...data.selfReviews, ...data.peerReviewsAssigned];
  const now = new Date();
  const pendingCount = allReviews.filter(r => r.status === 'draft' || r.status === 'pending_submission').length;
  const completedCount = allReviews.filter(r => r.status === 'submitted' || r.status === 'completed').length;
  const overdueCount = allReviews.filter(r => r.dueDate && new Date(r.dueDate) < now && r.status !== 'completed' && r.status !== 'submitted').length;
  const totalCount = allReviews.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    selfReviews: data.selfReviews,
    peerReviews: data.peerReviewsAssigned,
    cycles: [],
    pendingCount,
    completedCount,
    overdueCount,
    completionRate,
  };
}

/**
 * Saves or updates a personal note for the authenticated user.
 */
export async function savePersonalNoteAction(data: {
  id?: string;
  title: string;
  content: string;
  category: PersonalNote['category'];
  date?: string;
}): Promise<PersonalNote> {
  const currentUser = await getCurrentAppUser();
  const validated = SaveNoteSchema.parse(data);
  const now = Timestamp.now();
  const notesRef = adminDb.collection('personal-notes');

  const notePayload = {
    userId: currentUser.id,
    title: validated.title,
    content: validated.content,
    category: validated.category,
    date: validated.date,
    updatedAt: now,
  };

  let noteId = validated.id;

  if (noteId) {
    const docRef = notesRef.doc(noteId);
    const existing = await docRef.get();
    if (existing.exists && existing.data()?.userId === currentUser.id) {
      await docRef.update(notePayload);
    } else {
      throw new Error('Note not found or access denied.');
    }
  } else {
    const newDocRef = notesRef.doc();
    noteId = newDocRef.id;
    await newDocRef.set({
      ...notePayload,
      id: noteId,
      createdAt: now,
    });
  }

  revalidatePath('/dashboard');

  return {
    id: noteId,
    userId: currentUser.id,
    title: validated.title,
    content: validated.content,
    category: validated.category,
    date: validated.date,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
  };
}

/**
 * Deletes a personal note for the authenticated user.
 */
export async function deletePersonalNoteAction(noteId: string): Promise<{ success: boolean }> {
  const currentUser = await getCurrentAppUser();
  const noteRef = adminDb.collection('personal-notes').doc(noteId);
  const existing = await noteRef.get();

  if (!existing.exists) {
    return { success: true };
  }

  if (existing.data()?.userId !== currentUser.id) {
    throw new Error('Access denied to delete this note.');
  }

  await noteRef.delete();
  revalidatePath('/dashboard');
  return { success: true };
}
