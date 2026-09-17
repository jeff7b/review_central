import { adminDb } from './firebase-admin';
import type { MentorFeedback, QuestionFeedbackCollation, User } from '@/types';

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
 */
export async function getMemberFeedbackProfile(employeeId: string) {
  // Check if we have pre-configured collated data
  const mockData = mockCollatedDataByEmployeeId[employeeId];
  if (mockData) {
    // Get live feedback if available
    const liveFeedback = await getMentorFeedback(employeeId);
    return {
      employee: mockData.employee,
      collatedQuestions: mockData.collatedQuestions,
      mentorFeedback: liveFeedback || mockData.initialFeedback,
    };
  }

  // Fallback for other user IDs (e.g. users created via Admin Staff or custom IDs)
  let employeeName = `Team Member (${employeeId})`;
  let employeeEmail = `${employeeId}@example.com`;
  let employeeAvatar = `https://placehold.co/100x100.png?text=${employeeId.slice(0, 2).toUpperCase()}`;

  try {
    const userDoc = await adminDb.collection('users').doc(employeeId).get();
    if (userDoc.exists) {
      const data = userDoc.data() as User;
      employeeName = data.name;
      employeeEmail = data.email;
      employeeAvatar = data.avatarUrl || employeeAvatar;
    }
  } catch (err) {
    console.warn(`Firestore user lookup failed for ${employeeId}, using fallback:`, err);
  }

  const liveFeedback = await getMentorFeedback(employeeId);
  const defaultFeedback: MentorFeedback = liveFeedback || {
    id: `mf-${employeeId}`,
    employeeId,
    employeeName,
    mentorId: 'current-mentor',
    mentorName: 'Team Lead / Mentor',
    mentorRole: 'Engineering Manager',
    cycleId: 'cycle-active',
    cycleName: 'Active Review Cycle',
    sharedNotes: 'Notes from the 1:1 mentor feedback session will appear here in real time as discussed during the meeting.',
    strengths: ['Consistent Delivery', 'Team Collaboration'],
    growthAreas: ['Continuous Improvement', 'Knowledge Sharing'],
    actionItems: [
      { id: 'ai-default-1', text: 'Define key professional goals for this quarter', completed: false },
    ],
    isShared: true,
    lastUpdated: new Date().toISOString(),
    status: 'in_meeting',
  };

  const defaultCollatedQuestions: QuestionFeedbackCollation[] = [
    {
      questionId: 'q1',
      questionText: 'How has this team member contributed to core team goals and deliverables?',
      order: 1,
      category: 'Execution & Impact',
      selfAnswer: 'Maintained steady progress across all sprint backlog items and addressed reported bugs promptly.',
      peerAnswers: [
        {
          reviewerId: 'peer-1',
          reviewerName: 'Peer Reviewer 1',
          reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=P1',
          answerText: 'Reliable team contributor who completes tasks with solid code quality.',
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
          reviewerId: 'peer-2',
          reviewerName: 'Peer Reviewer 2',
          reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=P2',
          answerText: 'Constructive collaborator during code reviews and always ready to help team members.',
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
          reviewerId: 'peer-1',
          reviewerName: 'Peer Reviewer 1',
          reviewerAvatarUrl: 'https://placehold.co/100x100.png?text=P1',
          answerText: 'Would love to see them take ownership of leading larger end-to-end features.',
          sentiment: 'constructive',
        },
      ],
    },
  ];

  return {
    employee: {
      id: employeeId,
      name: employeeName,
      email: employeeEmail,
      avatarUrl: employeeAvatar,
      role: 'employee' as const,
      mentorName: 'Team Lead / Mentor',
      mentorRole: 'Engineering Manager',
    },
    collatedQuestions: defaultCollatedQuestions,
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
