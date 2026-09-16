'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getCurrentAppUser, requireLeaderOrAdminSession } from '@/lib/auth';
import type { TeamMemberFeedback, User, Review, PeerReviewAssignment, ReviewCycle } from '@/types';
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

export interface TeamDashboardData {
  members: TeamMemberFeedback[];
  totalMembers: number;
  submittedCount: number;
  atRiskCount: number;
  totalAssignedPeer: number;
  totalCompletedPeer: number;
  userRole: User['role'];
  isDirectReportsOnly: boolean;
  reviewCycles: ReviewCycle[];
  selectedCycleId: string;
}

export interface TeamMemberDetail {
  member: User;
  selfReview?: Review;
  peerReviewsAssigned: PeerReviewAssignment[];
  peerReviewsReceived: Array<{
    reviewerName: string;
    status: PeerReviewAssignment['status'];
    updatedAt: string;
    answers?: Array<{ questionId: string; answerText: string }>;
  }>;
}

/**
 * Fetches aggregated performance and review status across team members for the logged in leader/admin,
 * scoped to a specific Review Cycle.
 */
export async function getTeamDashboardDataAction(cycleId?: string): Promise<TeamDashboardData> {
  await requireLeaderOrAdminSession();
  const currentUser = await getCurrentAppUser();
  const isAdmin = currentUser.role === 'admin';

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
          participantIds: Array.isArray(d.participantIds) ? d.participantIds : [],
          createdAt: toISOString(d.createdAt),
          updatedAt: toISOString(d.updatedAt),
        } as ReviewCycle;
      });
      // Sort by startDate desc
      reviewCycles.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }

    // Determine selected cycle:
    let selectedCycleId = cycleId || '';
    if (!selectedCycleId || !reviewCycles.some(c => c.id === selectedCycleId)) {
      const active = reviewCycles.find(c => c.status === 'active');
      selectedCycleId = active ? active.id : (reviewCycles[0]?.id || '');
    }

    const selectedCycle = reviewCycles.find(c => c.id === selectedCycleId);

    // 2. Fetch users from 'users' collection
    const usersSnap = await adminDb.collection('users').orderBy('name').get();
    let allUsers: User[] = [];

    if (!usersSnap.empty) {
      allUsers = usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
    }

    // Determine team scope based on user role:
    let teamUsers: User[] = [];
    let isDirectReportsOnly = false;

    if (isAdmin) {
      teamUsers = allUsers.filter(u => u.id !== currentUser.id);
      if (teamUsers.length === 0 && allUsers.length > 0) {
        teamUsers = allUsers;
      }
    } else {
      const mentees = allUsers.filter(u => u.mentorId === currentUser.id);
      if (mentees.length > 0) {
        teamUsers = mentees;
        isDirectReportsOnly = true;
      } else {
        teamUsers = allUsers.filter(u => u.id !== currentUser.id && u.role !== 'admin');
      }
    }

    // If a cycle is selected and has participantIds defined, limit team members to cycle participants
    if (selectedCycle && selectedCycle.participantIds && selectedCycle.participantIds.length > 0) {
      teamUsers = teamUsers.filter(u => selectedCycle.participantIds.includes(u.id));
    }

    if (teamUsers.length === 0) {
      return {
        members: [],
        totalMembers: 0,
        submittedCount: 0,
        atRiskCount: 0,
        totalAssignedPeer: 0,
        totalCompletedPeer: 0,
        userRole: currentUser.role,
        isDirectReportsOnly,
        reviewCycles,
        selectedCycleId,
      };
    }

    // 3. Fetch self-reviews for the selected cycle (or all if no cycle selected)
    const selfReviewsSnap = await adminDb.collection('reviews')
      .where('type', '==', 'self')
      .get()
      .catch(() => null);

    const selfReviewsByMember = new Map<string, Review['status']>();
    if (selfReviewsSnap && !selfReviewsSnap.empty) {
      selfReviewsSnap.docs.forEach(doc => {
        const d = doc.data();
        const memberId = d.revieweeId || d.userId;
        if (memberId) {
          // Check cycle match if cycle is selected
          const cycleMatches = !selectedCycle || 
            d.reviewCycleId === selectedCycle.id || 
            (d.title && selectedCycle.name && d.title.includes(selectedCycle.name));

          if (cycleMatches) {
            const currentStatus = selfReviewsByMember.get(memberId);
            if (d.status === 'submitted' || d.status === 'completed') {
              selfReviewsByMember.set(memberId, 'submitted');
            } else if (d.status === 'draft' && currentStatus !== 'submitted') {
              selfReviewsByMember.set(memberId, 'draft');
            }
          }
        }
      });
    }

    // 4. Fetch peer-review-assignments for the selected cycle
    let assignmentsQuery = adminDb.collection('peer-review-assignments') as FirebaseFirestore.Query;
    if (selectedCycleId) {
      assignmentsQuery = assignmentsQuery.where('reviewCycleId', '==', selectedCycleId);
    }
    const assignmentsSnap = await assignmentsQuery.get().catch(() => null);

    const assignedByReviewer = new Map<string, { total: number; completed: number }>();
    if (assignmentsSnap && !assignmentsSnap.empty) {
      assignmentsSnap.docs.forEach(doc => {
        const a = doc.data() as PeerReviewAssignment;
        if (a.reviewerId) {
          const stats = assignedByReviewer.get(a.reviewerId) || { total: 0, completed: 0 };
          stats.total += 1;
          if (a.status === 'completed') {
            stats.completed += 1;
          }
          assignedByReviewer.set(a.reviewerId, stats);
        }
      });
    }

    // 5. Fetch any saved insights or AI evaluations
    let insightsQuery = adminDb.collection('team-insights') as FirebaseFirestore.Query;
    if (selectedCycleId) {
      insightsQuery = insightsQuery.where('reviewCycleId', '==', selectedCycleId);
    }
    const insightsSnap = await insightsQuery.get().catch(() => null);

    const insightsByMember = new Map<string, { summary?: string; sentiment?: any; improvementAreas?: string[] }>();
    if (insightsSnap && !insightsSnap.empty) {
      insightsSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.memberId) {
          insightsByMember.set(d.memberId, {
            summary: d.feedbackSummary,
            sentiment: d.sentiment,
            improvementAreas: d.keyImprovementAreas,
          });
        }
      });
    }

    // 6. Build TeamMemberFeedback objects
    let totalAssignedPeer = 0;
    let totalCompletedPeer = 0;
    let submittedCount = 0;
    let atRiskCount = 0;

    const members: TeamMemberFeedback[] = teamUsers.map(user => {
      const selfStatus = selfReviewsByMember.get(user.id) || 'not_started';
      const peerStats = assignedByReviewer.get(user.id) || { total: 0, completed: 0 };
      const insight = insightsByMember.get(user.id);

      if (selfStatus === 'submitted') {
        submittedCount += 1;
      }

      totalAssignedPeer += peerStats.total;
      totalCompletedPeer += peerStats.completed;

      const peerRate = peerStats.total > 0 ? peerStats.completed / peerStats.total : 1;
      const isAtRisk = selfStatus === 'not_started' || peerRate < 0.5;
      if (isAtRisk) {
        atRiskCount += 1;
      }

      const initials = (user.name || 'User').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase();

      return {
        id: user.id,
        name: user.name || 'User',
        avatarUrl: user.avatarUrl || `https://placehold.co/100x100.png?text=${initials}`,
        selfReviewStatus: selfStatus as TeamMemberFeedback['selfReviewStatus'],
        peerReviewsAssignedCount: peerStats.total,
        peerReviewsCompletedCount: peerStats.completed,
        feedbackSummary: insight?.summary,
        sentiment: insight?.sentiment,
        keyImprovementAreas: insight?.improvementAreas,
      };
    });

    return {
      members,
      totalMembers: members.length,
      submittedCount,
      atRiskCount,
      totalAssignedPeer,
      totalCompletedPeer,
      userRole: currentUser.role,
      isDirectReportsOnly,
      reviewCycles,
      selectedCycleId,
    };
  } catch (error) {
    console.error('Error fetching team dashboard data:', error);
    return {
      members: [],
      totalMembers: 0,
      submittedCount: 0,
      atRiskCount: 0,
      totalAssignedPeer: 0,
      totalCompletedPeer: 0,
      userRole: currentUser.role,
      isDirectReportsOnly: false,
      reviewCycles: [],
      selectedCycleId: '',
    };
  }
}

/**
 * Fetches detailed review information for a specific team member.
 */
export async function getTeamMemberDetailAction(memberId: string, cycleId?: string): Promise<TeamMemberDetail | null> {
  await requireLeaderOrAdminSession();

  try {
    const userDoc = await adminDb.collection('users').doc(memberId).get();
    if (!userDoc.exists) {
      return null;
    }
    const member = { id: userDoc.id, ...userDoc.data() } as User;

    // Fetch member's self-review
    let selfReviewQuery = adminDb.collection('reviews')
      .where('type', '==', 'self')
      .where('revieweeId', '==', memberId);

    if (cycleId) {
      selfReviewQuery = selfReviewQuery.where('reviewCycleId', '==', cycleId);
    }

    const selfReviewSnap = await selfReviewQuery.limit(1).get().catch(() => null);

    let selfReview: Review | undefined = undefined;
    if (selfReviewSnap && !selfReviewSnap.empty) {
      const d = selfReviewSnap.docs[0].data();
      selfReview = {
        id: selfReviewSnap.docs[0].id,
        title: d.title || 'Self-Review',
        type: 'self',
        status: d.status || 'draft',
        dueDate: d.dueDate ? toISOString(d.dueDate) : undefined,
        questionnaireId: d.questionnaireId || '',
        questions: d.questions || [],
        answers: d.answers || [],
        createdAt: toISOString(d.createdAt),
        updatedAt: toISOString(d.updatedAt),
      };
    }

    // Fetch peer reviews assigned to this member
    let peerAssignedQuery = adminDb.collection('peer-review-assignments')
      .where('reviewerId', '==', memberId);

    if (cycleId) {
      peerAssignedQuery = peerAssignedQuery.where('reviewCycleId', '==', cycleId);
    }

    const peerAssignedSnap = await peerAssignedQuery.get().catch(() => null);

    const peerReviewsAssigned: PeerReviewAssignment[] = [];
    if (peerAssignedSnap && !peerAssignedSnap.empty) {
      peerAssignedSnap.docs.forEach(doc => {
        const d = doc.data();
        peerReviewsAssigned.push({
          id: doc.id,
          reviewCycleId: d.reviewCycleId,
          revieweeId: d.revieweeId,
          revieweeName: d.revieweeName,
          revieweeAvatarUrl: d.revieweeAvatarUrl,
          reviewerId: d.reviewerId,
          reviewerName: d.reviewerName,
          reviewerAvatarUrl: d.reviewerAvatarUrl,
          questionnaireId: d.questionnaireId,
          status: d.status,
          dueDate: toISOString(d.dueDate),
          reviewId: d.reviewId,
          createdAt: toISOString(d.createdAt),
          updatedAt: toISOString(d.updatedAt),
        });
      });
    }

    // Fetch peer reviews received for this member
    let peerReceivedQuery = adminDb.collection('peer-review-assignments')
      .where('revieweeId', '==', memberId);

    if (cycleId) {
      peerReceivedQuery = peerReceivedQuery.where('reviewCycleId', '==', cycleId);
    }

    const peerReceivedSnap = await peerReceivedQuery.get().catch(() => null);

    const peerReviewsReceived: TeamMemberDetail['peerReviewsReceived'] = [];
    if (peerReceivedSnap && !peerReceivedSnap.empty) {
      for (const doc of peerReceivedSnap.docs) {
        const d = doc.data() as PeerReviewAssignment;
        let answers: Array<{ questionId: string; answerText: string }> | undefined = undefined;

        if (d.status === 'completed' && d.reviewId) {
          const reviewDoc = await adminDb.collection('peer-reviews').doc(d.reviewId).get().catch(() => null);
          if (reviewDoc && reviewDoc.exists) {
            answers = reviewDoc.data()?.answers;
          }
        }

        peerReviewsReceived.push({
          reviewerName: d.reviewerName,
          status: d.status,
          updatedAt: toISOString(d.updatedAt),
          answers,
        });
      }
    }

    return {
      member,
      selfReview,
      peerReviewsAssigned,
      peerReviewsReceived,
    };
  } catch (error) {
    console.error('Error fetching member detail:', error);
    return null;
  }
}
