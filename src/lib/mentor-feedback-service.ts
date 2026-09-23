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
 * Retrieves the member profile and collated feedback grouped by question.
 * Dynamically queries Firestore review-cycles, users, peer-reviews,
 * peer-review-assignments, self-reviews, team-insights, and questionnaires,
 * and overlays mentor approvals and inline edits.
 */
export async function getMemberFeedbackProfile(employeeId: string, cycleId?: string) {
  // 1. Resolve Review Cycle from Firestore
  let resolvedCycle: {
    id: string;
    name: string;
    status: string;
    peerReviewQuestionnaireId?: string | null;
    selfReviewQuestionnaireId?: string | null;
  } | undefined = undefined;
  let allReviewCycles: {
    id: string;
    name: string;
    status: string;
    startDate?: string;
    endDate?: string;
    peerReviewQuestionnaireId?: string | null;
    selfReviewQuestionnaireId?: string | null;
  }[] = [];

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
          selfReviewQuestionnaireId: cData.selfReviewQuestionnaireId || null,
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
          selfReviewQuestionnaireId: cData.selfReviewQuestionnaireId || null,
        };
        allReviewCycles = [{
          id: cycleDoc.id,
          name: resolvedCycle.name,
          status: resolvedCycle.status,
          peerReviewQuestionnaireId: resolvedCycle.peerReviewQuestionnaireId,
          selfReviewQuestionnaireId: resolvedCycle.selfReviewQuestionnaireId,
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

  interface SelfAnswerEntry {
    answerText: string;
    submittedAt?: string;
    order: number;
    questionId?: string;
    questionText?: string;
  }
  const selfAnswersByQuestionId = new Map<string, SelfAnswerEntry>();
  const selfAnswersByOrder = new Map<number, SelfAnswerEntry>();
  const selfAnswersByIndex = new Map<number, SelfAnswerEntry>();
  let selfQuestions: Question[] = [];

  try {
    const selfReviewsSnap = await adminDb.collection('reviews')
      .where('type', '==', 'self')
      .get()
      .catch(() => null);

    let matchingSelfDoc: Review | null = null;

    if (selfReviewsSnap && !selfReviewsSnap.empty) {
      const candidates = selfReviewsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Review & { userId?: string })
        .filter(
          (d) =>
            d.revieweeId === employeeId ||
            d.userId === employeeId ||
            (d.reviewee as any)?.id === employeeId
        );

      if (candidates.length > 0) {
        if (effectiveCycleId) {
          matchingSelfDoc =
            candidates.find(
              (d) =>
                d.reviewCycleId === effectiveCycleId ||
                (d.title && resolvedCycle?.name && d.title.includes(resolvedCycle.name))
            ) || null;
        }

        if (!matchingSelfDoc) {
          candidates.sort((a, b) => {
            const timeA = new Date(toISOString(a.updatedAt || a.createdAt)).getTime();
            const timeB = new Date(toISOString(b.updatedAt || b.createdAt)).getTime();
            return timeB - timeA;
          });
          matchingSelfDoc = candidates[0];
        }
      }
    }

    if (matchingSelfDoc) {
      if (matchingSelfDoc.status === 'submitted' || matchingSelfDoc.status === 'completed') {
        selfReviewStatus = 'submitted';
      } else if (matchingSelfDoc.status === 'draft') {
        selfReviewStatus = 'draft';
      }

      const sSubmittedAt = toISOString(matchingSelfDoc.updatedAt || matchingSelfDoc.createdAt);

      if (Array.isArray(matchingSelfDoc.questions) && matchingSelfDoc.questions.length > 0) {
        selfQuestions = matchingSelfDoc.questions;
      } else if (matchingSelfDoc.questionnaireId) {
        const qDoc = await adminDb.collection('questionnaires').doc(matchingSelfDoc.questionnaireId).get().catch(() => null);
        if (qDoc && qDoc.exists) {
          selfQuestions = qDoc.data()?.questions || [];
        }
      }

      if (selfQuestions.length === 0 && resolvedCycle?.selfReviewQuestionnaireId) {
        const qDoc = await adminDb.collection('questionnaires').doc(resolvedCycle.selfReviewQuestionnaireId).get().catch(() => null);
        if (qDoc && qDoc.exists) {
          selfQuestions = qDoc.data()?.questions || [];
        }
      }

      if (selfQuestions.length === 0) {
        const activeSelfSnap = await adminDb.collection('questionnaires')
          .where('type', '==', 'self')
          .where('isActive', '==', true)
          .limit(1)
          .get()
          .catch(() => null);
        if (activeSelfSnap && !activeSelfSnap.empty) {
          selfQuestions = activeSelfSnap.docs[0].data()?.questions || [];
        }
      }

      if (selfQuestions.length === 0) {
        selfQuestions = defaultSelfQuestions;
      }

      selfQuestions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const sAnswers = matchingSelfDoc.answers || [];
      sAnswers.forEach((a: any, idx: number) => {
        const answerText = a.answerText || '';
        if (!answerText) return;

        let matchedQ = selfQuestions.find((q) => q.id === a.questionId);
        let order = matchedQ?.order ?? (idx + 1);

        if (!matchedQ && a.questionId) {
          const numMatch = a.questionId.match(/\d+/);
          if (numMatch) {
            const parsedNum = parseInt(numMatch[0], 10);
            if (!isNaN(parsedNum)) {
              order = parsedNum;
              matchedQ = selfQuestions.find((q) => (q.order ?? 0) === parsedNum) || selfQuestions[parsedNum - 1];
            }
          }
        }

        const entry: SelfAnswerEntry = {
          answerText,
          submittedAt: sSubmittedAt,
          order,
          questionId: a.questionId,
          questionText: matchedQ?.text,
        };

        if (a.questionId) {
          selfAnswersByQuestionId.set(a.questionId, entry);
        }
        selfAnswersByOrder.set(order, entry);
        selfAnswersByIndex.set(idx + 1, entry);
      });

      selfQuestions.forEach((sq, sqIdx) => {
        const orderNum = sq.order ?? (sqIdx + 1);
        const ansByOrder = selfAnswersByOrder.get(orderNum);
        if (ansByOrder && !ansByOrder.questionText) {
          ansByOrder.questionText = sq.text;
        }
      });
    }
  } catch (err) {
    console.warn(`Error querying self-review for ${employeeId}:`, err);
  }

  // Helper function to resolve corresponding Self Review answer and question number
  function getSelfReviewForQuestion(
    peerQuestionId: string,
    peerQuestionOrder: number,
    peerIndex: number
  ): {
    answerText?: string;
    submittedAt?: string;
    selfQuestionNumber: number;
    selfQuestionText?: string;
  } {
    // 1. Match by questionId (in case of shared question IDs)
    let found = selfAnswersByQuestionId.get(peerQuestionId);

    // 2. Match by question order number (Peer Q1 -> Self Q1, Peer Q2 -> Self Q2, etc.)
    if (!found) {
      found = selfAnswersByOrder.get(peerQuestionOrder);
    }

    // 3. Match by index in sequence (1st peer Q -> 1st self answer)
    if (!found) {
      found = selfAnswersByIndex.get(peerIndex + 1);
    }

    const selfQuestionNumber = found?.order ?? peerQuestionOrder;
    const matchingSq = selfQuestions.find((sq) => sq.order === selfQuestionNumber) || selfQuestions[selfQuestionNumber - 1];

    return {
      answerText: found?.answerText,
      submittedAt: found?.submittedAt,
      selfQuestionNumber,
      selfQuestionText: found?.questionText || matchingSq?.text,
    };
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
            const questionOrder = templateQ?.order ?? (idx + 1);

            const selfInfo = getSelfReviewForQuestion(ans.questionId, questionOrder, idx);

            qObj = {
              questionId: ans.questionId,
              questionText,
              order: questionOrder,
              category: (templateQ as any)?.category || undefined,
              selfAnswer: selfInfo.answerText,
              selfAnswerSubmittedAt: selfInfo.submittedAt,
              selfQuestionNumber: selfInfo.selfQuestionNumber,
              selfQuestionText: selfInfo.selfQuestionText,
              peerAnswers: [],
            };
            questionMap.set(ans.questionId, qObj);
          } else if (!qObj.selfAnswer) {
            const selfInfo = getSelfReviewForQuestion(ans.questionId, qObj.order, idx);
            if (selfInfo.answerText) {
              qObj.selfAnswer = selfInfo.answerText;
              qObj.selfAnswerSubmittedAt = selfInfo.submittedAt;
              qObj.selfQuestionNumber = selfInfo.selfQuestionNumber;
              qObj.selfQuestionText = selfInfo.selfQuestionText;
            }
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

    // 6. If no peer reviews are completed yet, initialize questions from questionnaire or defaults so self review is visible
    if (realCollatedQuestions.length === 0) {
      let peerQuestions: Question[] = [];
      const qId = resolvedCycle?.peerReviewQuestionnaireId;
      if (qId) {
        let questionnaire = questionnaireCache.get(qId);
        if (!questionnaire) {
          const qDoc = await adminDb.collection('questionnaires').doc(qId).get().catch(() => null);
          if (qDoc && qDoc.exists) {
            questionnaire = { id: qDoc.id, ...qDoc.data() } as Questionnaire;
            questionnaireCache.set(qId, questionnaire);
          }
        }
        if (questionnaire?.questions && questionnaire.questions.length > 0) {
          peerQuestions = questionnaire.questions;
        }
      }

      if (peerQuestions.length === 0) {
        const activePeerSnap = await adminDb.collection('questionnaires')
          .where('type', '==', 'peer')
          .where('isActive', '==', true)
          .limit(1)
          .get()
          .catch(() => null);
        if (activePeerSnap && !activePeerSnap.empty) {
          peerQuestions = activePeerSnap.docs[0].data()?.questions || [];
        }
      }

      if (peerQuestions.length === 0) {
        peerQuestions = defaultPeerQuestions;
      }

      realCollatedQuestions = peerQuestions.map((q, idx) => {
        const questionOrder = q.order ?? (idx + 1);
        const selfInfo = getSelfReviewForQuestion(q.id, questionOrder, idx);
        return {
          questionId: q.id,
          questionText: q.text,
          order: questionOrder,
          category: (q as any).category || undefined,
          selfAnswer: selfInfo.answerText,
          selfAnswerSubmittedAt: selfInfo.submittedAt,
          selfQuestionNumber: selfInfo.selfQuestionNumber,
          selfQuestionText: selfInfo.selfQuestionText,
          peerAnswers: [],
          isApprovedForSharing: false,
        };
      }).sort((a, b) => a.order - b.order);
    }

    // Ensure all self-review answers are represented even if peer reviews had fewer questions
    selfAnswersByOrder.forEach((entry, orderNum) => {
      const alreadyIncluded = realCollatedQuestions.some(
        (q) => q.selfQuestionNumber === orderNum || q.order === orderNum
      );
      if (!alreadyIncluded && entry.answerText) {
        realCollatedQuestions.push({
          questionId: entry.questionId || `self-q-${orderNum}`,
          questionText: entry.questionText || `Question #${orderNum}`,
          order: orderNum,
          selfAnswer: entry.answerText,
          selfAnswerSubmittedAt: entry.submittedAt,
          selfQuestionNumber: orderNum,
          selfQuestionText: entry.questionText,
          peerAnswers: [],
          isApprovedForSharing: false,
        });
      }
    });
    realCollatedQuestions.sort((a, b) => a.order - b.order);
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
