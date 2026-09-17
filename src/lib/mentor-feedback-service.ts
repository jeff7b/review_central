import { adminDb } from './firebase-admin';
import type {
  MentorFeedback,
  QuestionFeedbackCollation,
  PeerQuestionResponse,
  User,
  Review,
  PeerReviewAssignment,
  Questionnaire,
  Question,
} from '@/types';

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

// In-memory store fallback for development / offline environments
const inMemoryMentorFeedback = new Map<string, MentorFeedback>();

/**
 * Retrieves the member profile and collated feedback grouped by question.
 * Dynamically queries Firestore review-cycles, users, peer-reviews,
 * peer-review-assignments, self-reviews, team-insights, and questionnaires,
 * and overlays mentor approvals and inline edits.
 */
export async function getMemberFeedbackProfile(employeeId: string, cycleId?: string) {
  // 1. Resolve Review Cycle from Firestore
  let resolvedCycle: { id: string; name: string; status: string; peerReviewQuestionnaireId?: string | null } | undefined = undefined;
  let allReviewCycles: { id: string; name: string; status: string; startDate?: string; endDate?: string; peerReviewQuestionnaireId?: string | null }[] = [];

  try {
    const cyclesSnap = await adminDb.collection('review-cycles').get().catch(() => null);
    if (cyclesSnap && !cyclesSnap.empty) {
      allReviewCycles = cyclesSnap.docs.map(d => {
        const cData = d.data();
        return {
          id: d.id,
          name: cData.name || 'Untitled Cycle',
          status: cData.status || 'draft',
          startDate: toISOString(cData.startDate),
          endDate: toISOString(cData.endDate),
          peerReviewQuestionnaireId: cData.peerReviewQuestionnaireId || null,
        };
      });
      allReviewCycles.sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());

      if (cycleId) {
        resolvedCycle = allReviewCycles.find(c => c.id === cycleId);
      }
      if (!resolvedCycle) {
        resolvedCycle = allReviewCycles.find(c => c.status === 'active') || allReviewCycles[0];
      }
    } else if (cycleId) {
      const cycleDoc = await adminDb.collection('review-cycles').doc(cycleId).get().catch(() => null);
      if (cycleDoc && cycleDoc.exists) {
        const cData = cycleDoc.data()!;
        resolvedCycle = {
          id: cycleDoc.id,
          name: cData.name || 'Active Review Cycle',
          status: cData.status || 'active',
          peerReviewQuestionnaireId: cData.peerReviewQuestionnaireId || null,
        };
        allReviewCycles = [{
          id: cycleDoc.id,
          name: resolvedCycle.name,
          status: resolvedCycle.status,
          peerReviewQuestionnaireId: resolvedCycle.peerReviewQuestionnaireId,
        }];
      }
    }
  } catch (err) {
    console.warn(`Failed to resolve review cycle:`, err);
  }

  const effectiveCycleId = resolvedCycle?.id || cycleId;
  const effectiveCycleName = resolvedCycle?.name || (resolvedCycle ? 'Active Review Cycle' : undefined);

  // 2. Fetch user profile and mentor information from Firestore
  let employeeName = `Team Member (${employeeId})`;
  let employeeEmail = `${employeeId}@example.com`;
  let employeeAvatar = `https://placehold.co/100x100.png?text=${employeeId.slice(0, 2).toUpperCase()}`;
  let employeeRole: 'employee' | 'team_leader' | 'admin' = 'employee';
  let mentorId = 'lead-1';
  let mentorName = 'Team Lead / Mentor';
  let mentorRole = 'Engineering Manager';
  let mentorAvatarUrl: string | undefined = undefined;

  try {
    const userDoc = await adminDb.collection('users').doc(employeeId).get();
    if (userDoc.exists) {
      const data = userDoc.data() as User;
      employeeName = data.name || employeeName;
      employeeEmail = data.email || employeeEmail;
      employeeAvatar = data.avatarUrl || employeeAvatar;
      employeeRole = data.role || 'employee';

      if (data.mentorId) {
        mentorId = data.mentorId;
        const mentorDoc = await adminDb.collection('users').doc(data.mentorId).get().catch(() => null);
        if (mentorDoc && mentorDoc.exists) {
          const mData = mentorDoc.data() as User;
          mentorName = mData.name || mentorName;
          mentorRole = mData.role === 'admin' ? 'Administrator / Lead' : 'Team Lead / Mentor';
          mentorAvatarUrl = mData.avatarUrl;
        }
      }
    }
  } catch (err) {
    console.warn(`Firestore user lookup failed for ${employeeId}:`, err);
  }

  // 3. Fetch live MentorFeedback state
  const liveFeedback = await getMentorFeedback(employeeId);
  const approvedIdsSet = new Set<string>(liveFeedback?.approvedResponseIds || []);
  const editedMap = liveFeedback?.editedResponses || {};

  // 4. Fetch self review from Firestore and determine selfReviewStatus
  let selfReviewStatus: 'not_started' | 'draft' | 'submitted' = 'not_started';
  let selfAnswersMap: Record<string, { answerText: string; submittedAt?: string }> = {};

  try {
    let selfReviewQuery = adminDb.collection('reviews')
      .where('type', '==', 'self')
      .where('revieweeId', '==', employeeId);

    if (effectiveCycleId) {
      selfReviewQuery = selfReviewQuery.where('reviewCycleId', '==', effectiveCycleId);
    }

    const selfSnap = await selfReviewQuery.limit(1).get().catch(() => null);

    if (selfSnap && !selfSnap.empty) {
      const sDoc = selfSnap.docs[0].data() as Review;
      const sAnswers = sDoc.answers || [];
      const sSubmittedAt = toISOString(sDoc.updatedAt || sDoc.createdAt);

      if (sDoc.status === 'submitted' || sDoc.status === 'completed') {
        selfReviewStatus = 'submitted';
      } else if (sDoc.status === 'draft') {
        selfReviewStatus = 'draft';
      }

      sAnswers.forEach((a: any) => {
        if (a.questionId) {
          selfAnswersMap[a.questionId] = {
            answerText: a.answerText || '',
            submittedAt: sSubmittedAt,
          };
        }
      });
    }
  } catch (err) {
    console.warn(`Error querying self-review for ${employeeId}:`, err);
  }

  // 5. Attempt to fetch completed peer reviews from Firestore
  let realCollatedQuestions: QuestionFeedbackCollation[] = [];
  const questionnaireCache = new Map<string, Questionnaire>();

  try {
    let peerReceivedQuery = adminDb.collection('peer-review-assignments')
      .where('revieweeId', '==', employeeId);

    if (effectiveCycleId) {
      peerReceivedQuery = peerReceivedQuery.where('reviewCycleId', '==', effectiveCycleId);
    }

    const peerAssignmentsSnap = await peerReceivedQuery.get().catch(() => null);
    const questionMap = new Map<string, QuestionFeedbackCollation>();

    if (peerAssignmentsSnap && !peerAssignmentsSnap.empty) {
      for (const aDoc of peerAssignmentsSnap.docs) {
        const assignment = aDoc.data() as PeerReviewAssignment;
        if (assignment.status !== 'completed' || !assignment.reviewId) continue;

        // Fetch actual peer review document
        const pReviewDoc = await adminDb.collection('peer-reviews').doc(assignment.reviewId).get().catch(() => null);
        if (!pReviewDoc || !pReviewDoc.exists) continue;

        const pReviewData = pReviewDoc.data()!;
        const answers: Array<{ questionId: string; answerText: string }> = pReviewData.answers || [];
        const submittedAt = toISOString(pReviewData.updatedAt || pReviewData.createdAt || assignment.updatedAt);

        // Fetch questionnaire if not cached
        const qId = assignment.questionnaireId || pReviewData.questionnaireId;
        if (qId && !questionnaireCache.has(qId)) {
          const qDoc = await adminDb.collection('questionnaires').doc(qId).get().catch(() => null);
          if (qDoc && qDoc.exists) {
            questionnaireCache.set(qId, { id: qDoc.id, ...qDoc.data() } as Questionnaire);
          }
        }

        const questionnaire = qId ? questionnaireCache.get(qId) : null;

        // Process answers in this peer review
        answers.forEach((ans, idx) => {
          if (!ans.questionId) return;

          let qObj = questionMap.get(ans.questionId);
          if (!qObj) {
            const templateQ = questionnaire?.questions?.find((q) => q.id === ans.questionId);
            const questionText = templateQ?.text || `Evaluation Question #${idx + 1}`;
            const questionOrder = templateQ?.order ?? (questionMap.size + 1);

            const selfInfo = selfAnswersMap[ans.questionId];

            qObj = {
              questionId: ans.questionId,
              questionText,
              order: questionOrder,
              category: (templateQ as any)?.category || undefined,
              selfAnswer: selfInfo?.answerText,
              selfAnswerSubmittedAt: selfInfo?.submittedAt,
              peerAnswers: [],
            };
            questionMap.set(ans.questionId, qObj);
          }

          const responseId = `resp-${aDoc.id}-${ans.questionId}`;
          const originalText = ans.answerText || '';
          const editedText = editedMap[responseId];
          const isApproved = approvedIdsSet.has(responseId);

          qObj.peerAnswers.push({
            id: responseId,
            reviewerId: assignment.reviewerId,
            reviewerName: assignment.reviewerName || 'Peer Reviewer',
            reviewerAvatarUrl: assignment.reviewerAvatarUrl,
            reviewerRole: 'Peer Reviewer',
            answerText: editedText !== undefined ? editedText : originalText,
            originalAnswerText: originalText,
            isEdited: editedText !== undefined && editedText !== originalText,
            isApproved,
            sentiment: 'positive',
            submittedAt,
          });
        });
      }

      realCollatedQuestions = Array.from(questionMap.values()).sort((a, b) => a.order - b.order);
      realCollatedQuestions.forEach(q => {
        q.isApprovedForSharing = q.peerAnswers.some(p => p.isApproved);
      });
    }

    // 6. If no peer reviews are completed yet, check if a template questionnaire is assigned to the cycle
    if (realCollatedQuestions.length === 0 && resolvedCycle?.peerReviewQuestionnaireId) {
      const qId = resolvedCycle.peerReviewQuestionnaireId;
      let questionnaire = questionnaireCache.get(qId);
      if (!questionnaire) {
        const qDoc = await adminDb.collection('questionnaires').doc(qId).get().catch(() => null);
        if (qDoc && qDoc.exists) {
          questionnaire = { id: qDoc.id, ...qDoc.data() } as Questionnaire;
          questionnaireCache.set(qId, questionnaire);
        }
      }

      if (questionnaire?.questions && questionnaire.questions.length > 0) {
        realCollatedQuestions = questionnaire.questions.map((q, idx) => {
          const selfInfo = selfAnswersMap[q.id];
          return {
            questionId: q.id,
            questionText: q.text,
            order: q.order ?? (idx + 1),
            category: (q as any).category || undefined,
            selfAnswer: selfInfo?.answerText,
            selfAnswerSubmittedAt: selfInfo?.submittedAt,
            peerAnswers: [],
            isApprovedForSharing: false,
          };
        }).sort((a, b) => a.order - b.order);
      }
    }
  } catch (err) {
    console.error('Error dynamically collating peer reviews from Firestore:', err);
  }

  // 7. Query AI Insights from Firestore 'team-insights' collection
  let aiInsights: {
    summary?: string;
    sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
    strengths: string[];
    growthAreas: string[];
  } | undefined = undefined;

  try {
    let insightsQuery = adminDb.collection('team-insights')
      .where('memberId', '==', employeeId) as FirebaseFirestore.Query;

    if (effectiveCycleId) {
      insightsQuery = insightsQuery.where('reviewCycleId', '==', effectiveCycleId);
    }

    const insightsSnap = await insightsQuery.limit(1).get().catch(() => null);
    if (insightsSnap && !insightsSnap.empty) {
      const insData = insightsSnap.docs[0].data();
      aiInsights = {
        summary: insData.feedbackSummary || undefined,
        sentiment: insData.sentiment || undefined,
        strengths: Array.isArray(insData.keyStrengths) ? insData.keyStrengths : [],
        growthAreas: Array.isArray(insData.keyImprovementAreas) ? insData.keyImprovementAreas : [],
      };
    }
  } catch (err) {
    console.warn(`Failed to fetch team-insights for ${employeeId}:`, err);
  }

  // 8. Initial / fallback MentorFeedback object
  const defaultFeedback: MentorFeedback = liveFeedback ? {
    ...liveFeedback,
    cycleId: effectiveCycleId || liveFeedback.cycleId,
    cycleName: effectiveCycleName || liveFeedback.cycleName || 'Active Review Cycle',
  } : {
    id: `mf-${employeeId}`,
    employeeId,
    employeeName,
    mentorId,
    mentorName,
    mentorRole,
    mentorAvatarUrl,
    cycleId: effectiveCycleId,
    cycleName: effectiveCycleName || 'Active Review Cycle',
    sharedNotes: '',
    strengths: [],
    growthAreas: [],
    actionItems: [],
    isShared: true,
    isPeerFeedbackShared: false,
    approvedResponseIds: [],
    editedResponses: {},
    lastUpdated: new Date().toISOString(),
    status: 'in_meeting',
  };

  return {
    employee: {
      id: employeeId,
      name: employeeName,
      email: employeeEmail,
      avatarUrl: employeeAvatar,
      role: employeeRole,
      mentorName,
      mentorRole,
    },
    selfReviewStatus,
    reviewCycle: resolvedCycle ? {
      id: resolvedCycle.id,
      name: resolvedCycle.name,
      status: resolvedCycle.status,
    } : undefined,
    reviewCycles: allReviewCycles.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
    })),
    collatedQuestions: realCollatedQuestions,
    mentorFeedback: defaultFeedback,
    aiInsights,
  };
}

/**
 * Fetches the current mentor feedback for an employee.
 */
export async function getMentorFeedback(employeeId: string): Promise<MentorFeedback | null> {
  // First check in-memory cache
  if (inMemoryMentorFeedback.has(employeeId)) {
    return inMemoryMentorFeedback.get(employeeId)!;
  }

  // Check Firestore
  try {
    const doc = await adminDb.collection('mentor-feedback').doc(employeeId).get();
    if (doc.exists) {
      const data = doc.data() as MentorFeedback;
      inMemoryMentorFeedback.set(employeeId, data);
      return data;
    }
  } catch (err) {
    console.warn(`Firestore mentor-feedback read failed for ${employeeId}:`, err);
  }

  return null;
}

/**
 * Saves or updates mentor feedback for an employee.
 */
export async function saveMentorFeedback(feedback: Partial<MentorFeedback> & { employeeId: string }): Promise<MentorFeedback> {
  const existing = await getMentorFeedback(feedback.employeeId);
  const now = new Date().toISOString();

  let resolvedCycleName = feedback.cycleName;
  const targetCycleId = feedback.cycleId || existing?.cycleId;

  if (targetCycleId && (!resolvedCycleName || resolvedCycleName === 'Current Review Cycle' || resolvedCycleName.includes('FY2024'))) {
    try {
      const cycleDoc = await adminDb.collection('review-cycles').doc(targetCycleId).get().catch(() => null);
      if (cycleDoc && cycleDoc.exists) {
        resolvedCycleName = cycleDoc.data()?.name || resolvedCycleName;
      }
    } catch (err) {
      // ignore
    }
  }

  const updated: MentorFeedback = {
    id: feedback.id || existing?.id || `mf-${feedback.employeeId}`,
    employeeId: feedback.employeeId,
    employeeName: feedback.employeeName || existing?.employeeName || `Employee ${feedback.employeeId}`,
    mentorId: feedback.mentorId || existing?.mentorId || 'lead-1',
    mentorName: feedback.mentorName || existing?.mentorName || 'Team Lead',
    mentorRole: feedback.mentorRole || existing?.mentorRole || 'Team Leader / Mentor',
    mentorAvatarUrl: feedback.mentorAvatarUrl || existing?.mentorAvatarUrl,
    cycleId: targetCycleId || 'current-cycle',
    cycleName: resolvedCycleName || existing?.cycleName || 'Active Review Cycle',
    sharedNotes: feedback.sharedNotes !== undefined ? feedback.sharedNotes : (existing?.sharedNotes || ''),
    strengths: feedback.strengths || existing?.strengths || [],
    growthAreas: feedback.growthAreas || existing?.growthAreas || [],
    actionItems: feedback.actionItems || existing?.actionItems || [],
    isShared: feedback.isShared !== undefined ? feedback.isShared : (existing?.isShared ?? true),
    isPeerFeedbackShared: feedback.isPeerFeedbackShared !== undefined ? feedback.isPeerFeedbackShared : (existing?.isPeerFeedbackShared ?? false),
    approvedResponseIds: feedback.approvedResponseIds !== undefined ? feedback.approvedResponseIds : (existing?.approvedResponseIds ?? []),
    editedResponses: feedback.editedResponses !== undefined ? feedback.editedResponses : (existing?.editedResponses ?? {}),
    lastUpdated: now,
    status: feedback.status || existing?.status || 'in_meeting',
  };

  // Update in-memory store
  inMemoryMentorFeedback.set(feedback.employeeId, updated);
  if (targetCycleId) {
    inMemoryMentorFeedback.set(`${feedback.employeeId}_${targetCycleId}`, updated);
  }

  // Update Firestore
  try {
    await adminDb.collection('mentor-feedback').doc(feedback.employeeId).set(updated, { merge: true });
    if (targetCycleId) {
      await adminDb.collection('mentor-feedback').doc(`${feedback.employeeId}_${targetCycleId}`).set(updated, { merge: true });
    }

    // If session is finalized or completed, record in evaluations collection for permanent historical record
    if (updated.status === 'finalized' || (updated.status as any) === 'completed') {
      const evalId = `eval-${feedback.employeeId}-${targetCycleId || 'cycle'}`;
      await adminDb.collection('evaluations').doc(evalId).set({
        id: evalId,
        revieweeId: feedback.employeeId,
        cycleId: targetCycleId,
        cycleTitle: updated.cycleName,
        completedDate: now,
        type: 'Mentor Performance Evaluation',
        overallRating: 'Completed',
        ratingTier: 'meets',
        reviewer: updated.mentorName,
        reviewerRole: updated.mentorRole,
        summary: updated.sharedNotes,
        keyStrengths: updated.strengths,
        growthAreas: updated.growthAreas,
        updatedAt: now,
      }, { merge: true });
    }
  } catch (err) {
    console.warn(`Firestore mentor-feedback write failed for ${feedback.employeeId}:`, err);
  }

  return updated;
}
