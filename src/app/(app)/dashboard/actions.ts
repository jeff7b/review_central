'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getCurrentAppUser } from '@/lib/auth';
import type { Review, PersonalNote, HistoricalEvaluation, PeerReviewAssignment, ReviewCycle, User, MentorFeedback } from '@/types';
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
  reviewCycles: ReviewCycle[];
  selectedCycleId: string;
}

/**
 * Fetches all dashboard data for the authenticated user from live Firestore collections,
 * scoped to a specific Review Cycle.
 * Uses the Review Cycle's defined Self and Peer Review questionnaires to build user review tasks.
 */
export async function getDashboardDataAction(cycleId?: string): Promise<DashboardData> {
  const currentUser = await getCurrentAppUser();
  const userId = currentUser.id;

  try {
    // 1. Fetch all review cycles
    const cyclesSnap = await adminDb.collection('review-cycles').get().catch(() => null);
    let reviewCycles: ReviewCycle[] = [];

    if (cyclesSnap && !cyclesSnap.empty) {
      reviewCycles = cyclesSnap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || 'Untitled Cycle',
          status: d.status || 'draft',
          startDate: toISOString(d.startDate),
          endDate: toISOString(d.endDate),
          selfReviewQuestionnaireId: d.selfReviewQuestionnaireId || null,
          peerReviewQuestionnaireId: d.peerReviewQuestionnaireId || null,
          participantIds: Array.isArray(d.participantIds) ? d.participantIds : [],
          createdAt: toISOString(d.createdAt),
          updatedAt: toISOString(d.updatedAt),
        } as ReviewCycle;
      });
      // Sort by startDate desc
      reviewCycles.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }

    const cyclesMap = new Map<string, ReviewCycle>(reviewCycles.map(c => [c.id, c]));

    // Determine selected cycle:
    let selectedCycleId = cycleId || '';
    if (!selectedCycleId || !reviewCycles.some(c => c.id === selectedCycleId)) {
      const active = reviewCycles.find(c => c.status === 'active');
      selectedCycleId = active ? active.id : (reviewCycles[0]?.id || '');
    }

    const selectedCycle = reviewCycles.find(c => c.id === selectedCycleId);

    // 2. Fetch user's self reviews from 'reviews' collection
    const selfReviewsSnap = await adminDb.collection('reviews')
      .where('type', '==', 'self')
      .where('revieweeId', '==', userId)
      .get()
      .catch(() => null);

    const userSelfReviews: Review[] = [];
    if (selfReviewsSnap && !selfReviewsSnap.empty) {
      selfReviewsSnap.docs.forEach(doc => {
        const d = doc.data();
        const cycleMatches = !selectedCycle ||
          d.reviewCycleId === selectedCycle.id ||
          (d.title && selectedCycle.name && d.title.includes(selectedCycle.name));

        if (cycleMatches) {
          userSelfReviews.push({
            id: doc.id,
            title: d.title || (selectedCycle ? `${selectedCycle.name} Self-Review` : 'Self-Review'),
            type: 'self',
            status: d.status || 'draft',
            dueDate: d.dueDate ? toISOString(d.dueDate) : (selectedCycle ? toISOString(selectedCycle.endDate) : undefined),
            questionnaireId: d.questionnaireId || selectedCycle?.selfReviewQuestionnaireId || '',
            reviewCycleId: d.reviewCycleId || selectedCycle?.id,
            questions: d.questions || [],
            answers: d.answers || [],
            createdAt: toISOString(d.createdAt),
            updatedAt: toISOString(d.updatedAt),
          });
        }
      });
    }

    // Check if user is a participant in the selected cycle and hasn't started a self-review yet
    if (selectedCycle) {
      const isParticipant = !selectedCycle.participantIds || selectedCycle.participantIds.length === 0 || selectedCycle.participantIds.includes(userId);
      if (isParticipant) {
        const alreadyHasReview = userSelfReviews.some(
          r => r.reviewCycleId === selectedCycle.id || (r.title && selectedCycle.name && r.title.includes(selectedCycle.name))
        );
        if (!alreadyHasReview) {
          userSelfReviews.push({
            id: `cycle-invitation-${selectedCycle.id}`,
            title: `${selectedCycle.name} Self-Review`,
            type: 'self',
            status: 'pending_submission',
            dueDate: toISOString(selectedCycle.endDate),
            questionnaireId: selectedCycle.selfReviewQuestionnaireId || '',
            reviewCycleId: selectedCycle.id,
            questions: [],
            answers: [],
            createdAt: toISOString(selectedCycle.createdAt),
            updatedAt: toISOString(selectedCycle.updatedAt),
          });
        }
      }
    }

    // 3. Fetch assigned peer reviews from 'peer-review-assignments'
    let assignedPeerQuery = adminDb.collection('peer-review-assignments')
      .where('reviewerId', '==', userId) as FirebaseFirestore.Query;

    if (selectedCycleId) {
      assignedPeerQuery = assignedPeerQuery.where('reviewCycleId', '==', selectedCycleId);
    }

    const assignedPeerSnap = await assignedPeerQuery.get().catch(() => null);

    const peerReviewsAssigned: Review[] = [];
    if (assignedPeerSnap && !assignedPeerSnap.empty) {
      assignedPeerSnap.docs.forEach(doc => {
        const a = doc.data() as PeerReviewAssignment;
        let reviewStatus: Review['status'] = 'pending_submission';
        if (a.status === 'completed') reviewStatus = 'completed';
        else if (a.status === 'in_progress') reviewStatus = 'draft';

        const cycle = a.reviewCycleId ? cyclesMap.get(a.reviewCycleId) : undefined;
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

    // 4. Fetch user's personal notes from 'personal-notes'
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
          userId: d.userId || '',
          title: d.title || '',
          content: d.content || '',
          category: d.category || 'achievement',
          date: d.date || new Date().toISOString().split('T')[0],
          createdAt: toISOString(d.createdAt),
          updatedAt: toISOString(d.updatedAt),
        });
      });
      // Sort notes by date descending
      notes.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    }

    // 5. Fetch feedback history (only previous cycles completed Mentor Feedback, NOT individual peer reviews)
    const feedbackHistory: HistoricalEvaluation[] = [];

    // Query 'evaluations' collection for previous cycles completed evaluations
    const evaluationsSnap = await adminDb.collection('evaluations')
      .where('revieweeId', '==', userId)
      .get()
      .catch(() => null);

    if (evaluationsSnap && !evaluationsSnap.empty) {
      evaluationsSnap.docs.forEach(doc => {
        const d = doc.data();
        // Exclude current cycle evaluations
        if (selectedCycleId && d.cycleId && d.cycleId === selectedCycleId) {
          return;
        }
        const cycle = d.cycleId ? cyclesMap.get(d.cycleId) : undefined;
        feedbackHistory.push({
          id: doc.id,
          cycleTitle: d.cycleTitle || cycle?.name || 'Performance Review Cycle',
          period: d.period || (cycle ? `${new Date(cycle.startDate).toLocaleDateString()} – ${new Date(cycle.endDate).toLocaleDateString()}` : ''),
          completedDate: toISOString(d.completedDate || d.updatedAt),
          type: d.type || 'Mentor Performance Evaluation',
          overallRating: d.overallRating || 'Completed',
          ratingTier: d.ratingTier || 'meets',
          reviewer: d.reviewer || 'Mentor / Team Lead',
          reviewerRole: d.reviewerRole || 'Mentor & Team Lead',
          summary: d.summary || '',
          keyStrengths: Array.isArray(d.keyStrengths) ? d.keyStrengths : [],
          growthAreas: Array.isArray(d.growthAreas) ? d.growthAreas : [],
        });
      });
    }

    // Query 'mentor-feedback' collection for completed/finalized feedback from previous cycles
    const mentorFeedbackSnap = await adminDb.collection('mentor-feedback')
      .where('employeeId', '==', userId)
      .get()
      .catch(() => null);

    // Also check single doc fallback
    const directUserFeedbackDoc = await adminDb.collection('mentor-feedback')
      .doc(userId)
      .get()
      .catch(() => null);

    const allMfItems: { id: string; data: MentorFeedback }[] = [];
    if (mentorFeedbackSnap && !mentorFeedbackSnap.empty) {
      mentorFeedbackSnap.docs.forEach(d => {
        allMfItems.push({ id: d.id, data: d.data() as MentorFeedback });
      });
    }
    if (directUserFeedbackDoc && directUserFeedbackDoc.exists && !allMfItems.some(item => item.id === directUserFeedbackDoc.id)) {
      allMfItems.push({ id: directUserFeedbackDoc.id, data: directUserFeedbackDoc.data() as MentorFeedback });
    }

    const recordedTitles = new Set(feedbackHistory.map(f => f.cycleTitle));

    allMfItems.forEach(item => {
      const mf = item.data;
      if (!mf) return;

      // Must be from a previous cycle, not the currently active/selected cycle
      const isCurrentCycle = selectedCycleId && mf.cycleId === selectedCycleId;
      if (isCurrentCycle) {
        return;
      }

      const cycle = mf.cycleId ? cyclesMap.get(mf.cycleId) : undefined;
      // Must be finalized/completed
      const isCompleted = mf.status === 'finalized' || (mf.status as any) === 'completed' || (cycle && cycle.status === 'closed' && mf.isShared);
      if (!isCompleted) {
        return;
      }

      const cycleTitle = mf.cycleName || cycle?.name || 'Past Review Cycle';
      if (recordedTitles.has(cycleTitle)) {
        return;
      }
      recordedTitles.add(cycleTitle);

      feedbackHistory.push({
        id: `eval-${item.id}`,
        cycleTitle,
        period: cycle ? `${new Date(cycle.startDate).toLocaleDateString()} – ${new Date(cycle.endDate).toLocaleDateString()}` : '',
        completedDate: toISOString(mf.lastUpdated),
        type: '1:1 Mentor Feedback',
        overallRating: 'Completed',
        ratingTier: 'meets',
        reviewer: mf.mentorName || 'Mentor / Team Lead',
        reviewerRole: mf.mentorRole || 'Mentor & Team Lead',
        summary: mf.sharedNotes || '',
        keyStrengths: Array.isArray(mf.strengths) ? mf.strengths : [],
        growthAreas: Array.isArray(mf.growthAreas) ? mf.growthAreas : [],
      });
    });

    // Sort feedbackHistory by completedDate desc
    feedbackHistory.sort((a, b) => new Date(b.completedDate || 0).getTime() - new Date(a.completedDate || 0).getTime());

    return {
      selfReviews: userSelfReviews,
      peerReviewsAssigned,
      notes,
      feedbackHistory,
      currentUser,
      reviewCycles,
      selectedCycleId,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      selfReviews: [],
      peerReviewsAssigned: [],
      notes: [],
      feedbackHistory: [],
      currentUser,
      reviewCycles: [],
      selectedCycleId: '',
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
