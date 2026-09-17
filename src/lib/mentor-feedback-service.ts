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

// Initial mock collations for team members
const mockCollatedDataByEmployeeId: Record<string, {
  employee: { id: string; name: string; email: string; avatarUrl: string; role: 'employee'; mentorName: string; mentorRole: string };
  collatedQuestions: QuestionFeedbackCollation[];
  initialFeedback: MentorFeedback;
}> = {
  tm1: {
    employee: {
      id: 'tm1',
      name: 'Alice Wonderland',
      email: 'alice.wonderland@example.com',
      avatarUrl: 'https://placehold.co/100x100.png?text=AW',
      role: 'employee',
      mentorName: 'Diana Prince',
      mentorRole: 'Engineering Director / Lead',
    },
    initialFeedback: {
      id: 'mf-tm1',
      employeeId: 'tm1',
      employeeName: 'Alice Wonderland',
      mentorId: 'tm4',
      mentorName: 'Diana Prince',
      mentorRole: 'Engineering Director',
      cycleId: 'cycle-2024-h2',
      cycleName: 'FY2024 H2 Review Cycle',
      sharedNotes: 'Alice had a standout performance this half. Her leadership in migrating our core authentication services was recognized across engineering. In our 1:1 discussion, we aligned on her path towards Staff Engineer, specifically expanding her influence into cross-team system design and mentoring upcoming engineers.',
      strengths: [
        'High technical craftsmanship & zero-defect delivery',
        'Exceptional cross-functional communication during incidents',
        'Proactive architectural documentation'
      ],
      growthAreas: [
        'Strategic thinking & multi-quarter project scoping',
        'Delegating sub-tasks to junior engineers rather than solo execution'
      ],
      actionItems: [
        { id: 'ai-1', text: 'Lead the Q4 architecture review for the multi-tenant event pipeline', completed: false },
        { id: 'ai-2', text: 'Formalize 1:1 mentorship schedule with 2 junior team members', completed: true },
        { id: 'ai-3', text: 'Present auth migration retro at the Engineering All-Hands meeting', completed: false },
      ],
      isShared: true,
      lastUpdated: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      status: 'in_meeting',
    },
    collatedQuestions: [
      {
        questionId: 'q1',
        questionText: 'How has this team member contributed to core team goals and deliverables?',
        order: 1,
        category: 'Execution & Impact',
        selfAnswer: 'I spearheaded the auth middleware refactor and hit all sprint milestones 2 weeks ahead of our target deadline. I also reduced CI/CD test pipeline build runtimes by 20% through smart test sharding.',
        selfAnswerSubmittedAt: '2024-09-12T14:20:00Z',
        peerAnswers: [
          {
            reviewerId: 'tm2',
            reviewerName: 'Bob The Builder',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=BB',
            reviewerRole: 'Senior Software Engineer',
            answerText: 'Alice was instrumental in unblocking our release candidate. Her architectural decisions on the auth migration were clean, bulletproof, and made integrating downstream services effortless.',
            sentiment: 'positive',
            submittedAt: '2024-09-13T10:15:00Z',
          },
          {
            reviewerId: 'tm3',
            reviewerName: 'Charlie Brown',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=CB',
            reviewerRole: 'Software Engineer',
            answerText: 'Consistently provides prompt reviews and reliably finishes her sprint commitments. Whenever there was a priority fire, Alice stepped up immediately to diagnose and patch it.',
            sentiment: 'positive',
            submittedAt: '2024-09-14T09:45:00Z',
          },
          {
            reviewerId: 'tm4',
            reviewerName: 'Diana Prince',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=DP',
            reviewerRole: 'Engineering Director',
            answerText: 'Alice consistently sets the gold standard for high execution quality on the team. Deliverables are always well tested, robust, and delivered with clear stakeholder communications.',
            sentiment: 'positive',
            submittedAt: '2024-09-14T16:30:00Z',
          },
          {
            reviewerId: 'tm5',
            reviewerName: 'Alex Chen',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=AC',
            reviewerRole: 'Product Designer',
            answerText: 'Great partner during feature discovery. Alice always brought sensible technical feasibility considerations early, preventing costly redesigns later in the sprint.',
            sentiment: 'positive',
            submittedAt: '2024-09-15T11:00:00Z',
          },
        ],
      },
      {
        questionId: 'q2',
        questionText: 'Describe a situation where this person demonstrated strong teamwork and collaboration.',
        order: 2,
        category: 'Collaboration',
        selfAnswer: 'During the high-severity production sync failure in August, I coordinated with DevOps and QA to isolate the root cause, establish a hotfix branch, and document preventive safeguards.',
        selfAnswerSubmittedAt: '2024-09-12T14:25:00Z',
        peerAnswers: [
          {
            reviewerId: 'tm2',
            reviewerName: 'Bob The Builder',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=BB',
            reviewerRole: 'Senior Software Engineer',
            answerText: 'Alice paired with me for two hours when I was struggling with complex Firestore security rule propagation. She was remarkably patient and explained the underlying authentication mechanics clearly.',
            sentiment: 'positive',
            submittedAt: '2024-09-13T10:20:00Z',
          },
          {
            reviewerId: 'tm3',
            reviewerName: 'Charlie Brown',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=CB',
            reviewerRole: 'Software Engineer',
            answerText: 'Very approachable in Slack and Teams. Even during crunch times, she never hesitates to jump on a huddle to debug code together.',
            sentiment: 'positive',
            submittedAt: '2024-09-14T09:50:00Z',
          },
          {
            reviewerId: 'tm4',
            reviewerName: 'Diana Prince',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=DP',
            reviewerRole: 'Engineering Director',
            answerText: 'Facilitated several cross-team syncs with product and security teams smoothly, ensuring all security compliance requirements were addressed without delaying our launch.',
            sentiment: 'positive',
            submittedAt: '2024-09-14T16:35:00Z',
          },
        ],
      },
      {
        questionId: 'q3',
        questionText: 'What are this team member\'s key strengths and capabilities from your perspective?',
        order: 3,
        category: 'Strengths',
        selfAnswer: 'Deep problem-solving rigor, automated testing practices, and a strong drive to simplify complicated backend architectures for the rest of the team.',
        selfAnswerSubmittedAt: '2024-09-12T14:30:00Z',
        peerAnswers: [
          {
            reviewerId: 'tm2',
            reviewerName: 'Bob The Builder',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=BB',
            reviewerRole: 'Senior Software Engineer',
            answerText: 'Superb code quality, lightning fast PR review feedback, and deep mastery of TypeScript and cloud data structures.',
            sentiment: 'positive',
            submittedAt: '2024-09-13T10:25:00Z',
          },
          {
            reviewerId: 'tm3',
            reviewerName: 'Charlie Brown',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=CB',
            reviewerRole: 'Software Engineer',
            answerText: 'Extremely calm under pressure. Whenever production incidents occur, Alice brings clarity, structured troubleshooting, and rapid solutions.',
            sentiment: 'positive',
            submittedAt: '2024-09-14T09:55:00Z',
          },
          {
            reviewerId: 'tm4',
            reviewerName: 'Diana Prince',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=DP',
            reviewerRole: 'Engineering Director',
            answerText: 'High agency, technical depth, and relentless focus on reliability and developer ergonomics.',
            sentiment: 'positive',
            submittedAt: '2024-09-14T16:40:00Z',
          },
        ],
      },
      {
        questionId: 'q4',
        questionText: 'In what areas could this peer improve, develop, or expand their impact further?',
        order: 4,
        category: 'Growth & Development',
        selfAnswer: 'I tend to take on heavy architecture tasks entirely myself instead of breaking them down for others. I want to improve my delegation and spend more time coaching newer engineers.',
        selfAnswerSubmittedAt: '2024-09-12T14:35:00Z',
        peerAnswers: [
          {
            reviewerId: 'tm2',
            reviewerName: 'Bob The Builder',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=BB',
            reviewerRole: 'Senior Software Engineer',
            answerText: 'Sometimes Alice carries too much of the cognitive load alone. It would be great to see her delegate more sub-components to the rest of the team so we can learn from her.',
            sentiment: 'constructive',
            submittedAt: '2024-09-13T10:30:00Z',
          },
          {
            reviewerId: 'tm4',
            reviewerName: 'Diana Prince',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=DP',
            reviewerRole: 'Engineering Director',
            answerText: 'Could focus more on communicating high-level technical vision to executive stakeholders and non-technical partners, articulating business outcomes alongside technical achievements.',
            sentiment: 'constructive',
            submittedAt: '2024-09-14T16:45:00Z',
          },
        ],
      },
      {
        questionId: 'q5',
        questionText: 'Provide any additional feedback or recommendations to support their ongoing growth.',
        order: 5,
        category: 'General / Career Path',
        selfAnswer: 'Looking forward to taking on broader system architecture responsibility and continuing to partner closely with leadership on technology strategy.',
        selfAnswerSubmittedAt: '2024-09-12T14:40:00Z',
        peerAnswers: [
          {
            reviewerId: 'tm2',
            reviewerName: 'Bob The Builder',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=BB',
            reviewerRole: 'Senior Software Engineer',
            answerText: 'A pleasure to work with every single day! Alice is definitely ready for senior leadership responsibilities.',
            sentiment: 'positive',
            submittedAt: '2024-09-13T10:35:00Z',
          },
          {
            reviewerId: 'tm4',
            reviewerName: 'Diana Prince',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=DP',
            reviewerRole: 'Engineering Director',
            answerText: 'Keep fostering the open engineering culture you have helped build. We are excited to support your path to Staff Engineer in the upcoming cycle.',
            sentiment: 'positive',
            submittedAt: '2024-09-14T16:50:00Z',
          },
        ],
      },
    ],
  },
  tm2: {
    employee: {
      id: 'tm2',
      name: 'Bob The Builder',
      email: 'bob.builder@example.com',
      avatarUrl: 'https://placehold.co/100x100.png?text=BB',
      role: 'employee',
      mentorName: 'Diana Prince',
      mentorRole: 'Engineering Director / Lead',
    },
    initialFeedback: {
      id: 'mf-tm2',
      employeeId: 'tm2',
      employeeName: 'Bob The Builder',
      mentorId: 'tm4',
      mentorName: 'Diana Prince',
      mentorRole: 'Engineering Director',
      cycleId: 'cycle-2024-h2',
      cycleName: 'FY2024 H2 Review Cycle',
      sharedNotes: 'Bob has demonstrated deep technical skills and solid delivery across frontend infrastructure. During our session, we discussed strengthening proactive stakeholder communication and structuring daily updates to avoid end-of-sprint crunches.',
      strengths: [
        'Solid domain knowledge and frontend build optimization',
        'Willingness to tackle thorny legacy bugs',
      ],
      growthAreas: [
        'Stakeholder and non-technical communication',
        'Time estimation and progressive sprint delivery',
      ],
      actionItems: [
        { id: 'ai-b1', text: 'Share twice-weekly async progress updates on #eng-announcements', completed: false },
        { id: 'ai-b2', text: 'Partner with product manager on user story acceptance criteria prior to sprint kickoff', completed: true },
      ],
      isShared: true,
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      status: 'in_meeting',
    },
    collatedQuestions: [
      {
        questionId: 'q1',
        questionText: 'How has this team member contributed to core team goals and deliverables?',
        order: 1,
        category: 'Execution & Impact',
        selfAnswer: 'Focused on UI component library refactoring and resolved 14 long-standing UI layout defects.',
        selfAnswerSubmittedAt: '2024-09-10T11:00:00Z',
        peerAnswers: [
          {
            reviewerId: 'tm1',
            reviewerName: 'Alice Wonderland',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=AW',
            reviewerRole: 'Lead Software Engineer',
            answerText: 'Bob did great work modernizing our form validation components. Code quality is consistently high.',
            sentiment: 'positive',
            submittedAt: '2024-09-12T15:00:00Z',
          },
        ],
      },
      {
        questionId: 'q2',
        questionText: 'Describe a situation where this person demonstrated strong teamwork and collaboration.',
        order: 2,
        category: 'Collaboration',
        selfAnswer: 'Collaborated with Alice on aligning the API payload contracts for review forms.',
        selfAnswerSubmittedAt: '2024-09-10T11:15:00Z',
        peerAnswers: [
          {
            reviewerId: 'tm1',
            reviewerName: 'Alice Wonderland',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=AW',
            reviewerRole: 'Lead Software Engineer',
            answerText: 'Active in PR discussions and responsive to design changes during feature development.',
            sentiment: 'positive',
            submittedAt: '2024-09-12T15:10:00Z',
          },
        ],
      },
    ],
  },
};

/**
 * Retrieves the member profile and collated feedback grouped by question.
 * Dynamically queries Firestore peer-reviews, peer-review-assignments, self-reviews,
 * and questionnaires, and overlays mentor approvals and inline edits.
 */
export async function getMemberFeedbackProfile(employeeId: string, cycleId?: string) {
  // 1. Fetch user profile from Firestore
  let employeeName = `Team Member (${employeeId})`;
  let employeeEmail = `${employeeId}@example.com`;
  let employeeAvatar = `https://placehold.co/100x100.png?text=${employeeId.slice(0, 2).toUpperCase()}`;
  let mentorName = 'Team Lead / Mentor';
  let mentorRole = 'Engineering Manager';

  try {
    const userDoc = await adminDb.collection('users').doc(employeeId).get();
    if (userDoc.exists) {
      const data = userDoc.data() as User;
      employeeName = data.name || employeeName;
      employeeEmail = data.email || employeeEmail;
      employeeAvatar = data.avatarUrl || employeeAvatar;

      if (data.mentorId) {
        const mentorDoc = await adminDb.collection('users').doc(data.mentorId).get().catch(() => null);
        if (mentorDoc && mentorDoc.exists) {
          const mData = mentorDoc.data() as User;
          mentorName = mData.name || mentorName;
          mentorRole = mData.role === 'admin' ? 'Administrator / Lead' : 'Team Lead / Mentor';
        }
      }
    }
  } catch (err) {
    console.warn(`Firestore user lookup failed for ${employeeId}:`, err);
  }

  // 2. Fetch live MentorFeedback state
  const liveFeedback = await getMentorFeedback(employeeId);
  const approvedIdsSet = new Set<string>(liveFeedback?.approvedResponseIds || []);
  const editedMap = liveFeedback?.editedResponses || {};

  // 3. Attempt to fetch real reviews from Firestore
  let realCollatedQuestions: QuestionFeedbackCollation[] = [];

  try {
    // 3a. Fetch self review
    let selfReviewQuery = adminDb.collection('reviews')
      .where('type', '==', 'self')
      .where('revieweeId', '==', employeeId);

    if (cycleId) {
      selfReviewQuery = selfReviewQuery.where('reviewCycleId', '==', cycleId);
    }

    const selfSnap = await selfReviewQuery.limit(1).get().catch(() => null);
    let selfAnswersMap: Record<string, { answerText: string; submittedAt?: string }> = {};

    if (selfSnap && !selfSnap.empty) {
      const sDoc = selfSnap.docs[0].data();
      const sAnswers = sDoc.answers || [];
      const sSubmittedAt = toISOString(sDoc.updatedAt || sDoc.createdAt);
      sAnswers.forEach((a: any) => {
        if (a.questionId) {
          selfAnswersMap[a.questionId] = {
            answerText: a.answerText || '',
            submittedAt: sSubmittedAt,
          };
        }
      });
    }

    // 3b. Fetch completed peer review assignments where user is reviewee
    let peerReceivedQuery = adminDb.collection('peer-review-assignments')
      .where('revieweeId', '==', employeeId);

    if (cycleId) {
      peerReceivedQuery = peerReceivedQuery.where('reviewCycleId', '==', cycleId);
    }

    const peerAssignmentsSnap = await peerReceivedQuery.get().catch(() => null);

    // Map to collect questions: questionId -> QuestionFeedbackCollation
    const questionMap = new Map<string, QuestionFeedbackCollation>();

    if (peerAssignmentsSnap && !peerAssignmentsSnap.empty) {
      // Collect questionnaire templates to ensure questions are properly named & ordered
      const questionnaireCache = new Map<string, Questionnaire>();

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
  } catch (err) {
    console.error('Error dynamically collating peer reviews from Firestore:', err);
  }

  // 4. Fallback to mock data if Firestore has no submitted peer reviews yet
  let finalQuestions: QuestionFeedbackCollation[] = [];

  if (realCollatedQuestions.length > 0) {
    finalQuestions = realCollatedQuestions;
  } else if (mockCollatedDataByEmployeeId[employeeId]) {
    const mock = mockCollatedDataByEmployeeId[employeeId];
    finalQuestions = mock.collatedQuestions.map((q) => ({
      ...q,
      peerAnswers: q.peerAnswers.map((p, pIdx) => {
        const respId = `resp-${employeeId}-${q.questionId}-${pIdx}`;
        const originalText = p.answerText;
        const editedText = editedMap[respId];
        const isApproved = approvedIdsSet.has(respId);

        return {
          ...p,
          id: respId,
          originalAnswerText: originalText,
          answerText: editedText !== undefined ? editedText : originalText,
          isEdited: editedText !== undefined && editedText !== originalText,
          isApproved,
        };
      }),
      isApprovedForSharing: q.peerAnswers.some((_, pIdx) =>
        approvedIdsSet.has(`resp-${employeeId}-${q.questionId}-${pIdx}`)
      ),
    }));
  } else {
    // Default fallback questions with generated response IDs
    const defaultQs: QuestionFeedbackCollation[] = [
      {
        questionId: 'q1',
        questionText: 'How has this team member contributed to core team goals and deliverables?',
        order: 1,
        category: 'Execution & Impact',
        selfAnswer: 'Maintained steady progress across all sprint backlog items and addressed reported bugs promptly.',
        peerAnswers: [
          {
            id: `resp-${employeeId}-q1-0`,
            reviewerId: 'peer-1',
            reviewerName: 'Peer Reviewer 1',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=P1',
            answerText: editedMap[`resp-${employeeId}-q1-0`] || 'Reliable team contributor who completes tasks with solid code quality.',
            originalAnswerText: 'Reliable team contributor who completes tasks with solid code quality.',
            isEdited: !!editedMap[`resp-${employeeId}-q1-0`],
            isApproved: approvedIdsSet.has(`resp-${employeeId}-q1-0`),
            sentiment: 'positive',
          },
        ],
      },
      {
        questionId: 'q2',
        questionText: 'Describe a situation where this person demonstrated strong teamwork and collaboration.',
        order: 2,
        category: 'Collaboration',
        selfAnswer: 'Participated actively in daily standups and sprint retrospectives.',
        peerAnswers: [
          {
            id: `resp-${employeeId}-q2-0`,
            reviewerId: 'peer-2',
            reviewerName: 'Peer Reviewer 2',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=P2',
            answerText: editedMap[`resp-${employeeId}-q2-0`] || 'Constructive collaborator during code reviews and always ready to help team members.',
            originalAnswerText: 'Constructive collaborator during code reviews and always ready to help team members.',
            isEdited: !!editedMap[`resp-${employeeId}-q2-0`],
            isApproved: approvedIdsSet.has(`resp-${employeeId}-q2-0`),
            sentiment: 'positive',
          },
        ],
      },
      {
        questionId: 'q3',
        questionText: 'In what areas could this peer improve, develop, or expand their impact further?',
        order: 3,
        category: 'Growth & Development',
        selfAnswer: 'Aiming to expand knowledge in system architecture and technical leadership.',
        peerAnswers: [
          {
            id: `resp-${employeeId}-q3-0`,
            reviewerId: 'peer-1',
            reviewerName: 'Peer Reviewer 1',
            reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=P1',
            answerText: editedMap[`resp-${employeeId}-q3-0`] || 'Would love to see them take ownership of leading larger end-to-end features.',
            originalAnswerText: 'Would love to see them take ownership of leading larger end-to-end features.',
            isEdited: !!editedMap[`resp-${employeeId}-q3-0`],
            isApproved: approvedIdsSet.has(`resp-${employeeId}-q3-0`),
            sentiment: 'constructive',
          },
        ],
      },
    ];
    defaultQs.forEach(q => {
      q.isApprovedForSharing = q.peerAnswers.some(p => p.isApproved);
    });
    finalQuestions = defaultQs;
  }

  // 5. Initial MentorFeedback object if not existing
  const defaultFeedback: MentorFeedback = liveFeedback || {
    id: `mf-${employeeId}`,
    employeeId,
    employeeName,
    mentorId: 'current-mentor',
    mentorName,
    mentorRole,
    cycleId: cycleId || 'cycle-active',
    cycleName: 'FY2024 H2 Review Cycle',
    sharedNotes: 'Notes from the 1:1 mentor feedback session will appear here in real time as discussed during the meeting.',
    strengths: ['High Technical Craftsmanship', 'Team Collaboration'],
    growthAreas: ['Cross-team Communication', 'Mentoring Junior Engineers'],
    actionItems: [
      { id: 'ai-default-1', text: 'Define key professional development goals for this quarter', completed: false },
    ],
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
      role: 'employee' as const,
      mentorName,
      mentorRole,
    },
    collatedQuestions: finalQuestions,
    mentorFeedback: defaultFeedback,
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

  // If mock exists, populate in-memory and return
  if (mockCollatedDataByEmployeeId[employeeId]) {
    const initial = mockCollatedDataByEmployeeId[employeeId].initialFeedback;
    inMemoryMentorFeedback.set(employeeId, initial);
    return initial;
  }

  return null;
}

/**
 * Saves or updates mentor feedback for an employee.
 */
export async function saveMentorFeedback(feedback: Partial<MentorFeedback> & { employeeId: string }): Promise<MentorFeedback> {
  const existing = await getMentorFeedback(feedback.employeeId);
  const now = new Date().toISOString();

  const updated: MentorFeedback = {
    id: feedback.id || existing?.id || `mf-${feedback.employeeId}`,
    employeeId: feedback.employeeId,
    employeeName: feedback.employeeName || existing?.employeeName || `Employee ${feedback.employeeId}`,
    mentorId: feedback.mentorId || existing?.mentorId || 'lead-1',
    mentorName: feedback.mentorName || existing?.mentorName || 'Team Lead',
    mentorRole: feedback.mentorRole || existing?.mentorRole || 'Team Leader / Mentor',
    cycleId: feedback.cycleId || existing?.cycleId || 'current-cycle',
    cycleName: feedback.cycleName || existing?.cycleName || 'Current Review Cycle',
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

  // Update Firestore
  try {
    await adminDb.collection('mentor-feedback').doc(feedback.employeeId).set(updated, { merge: true });
  } catch (err) {
    console.warn(`Firestore mentor-feedback write failed for ${feedback.employeeId}:`, err);
  }

  return updated;
}
