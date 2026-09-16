'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getCurrentAppUser, requireLeaderOrAdminSession } from '@/lib/auth';
import type { TeamMemberFeedback, User, Review, PeerReviewAssignment } from '@/types';
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
 * Fetches aggregated performance and review status across team members for the logged in leader/admin.
 */
export async function getTeamDashboardDataAction(): Promise<TeamDashboardData> {
  await requireLeaderOrAdminSession();
  const currentUser = await getCurrentAppUser();
  const isAdmin = currentUser.role === 'admin';

  try {
    // 1. Fetch users from 'users' collection
    const usersSnap = await adminDb.collection('users').orderBy('name').get();
    let allUsers: User[] = [];

    if (!usersSnap.empty) {
      allUsers = usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
    }

    // Determine team scope:
    // If admin: all users (excluding current admin user if multiple users exist, or all staff)
    // If team_leader: users who have mentorId == currentUser.id (or all users if no mentor assignments exist yet)
    let teamUsers: User[] = [];
    let isDirectReportsOnly = false;

    if (isAdmin) {
      // Admins see all staff members
      teamUsers = allUsers.filter(u => u.id !== currentUser.id);
      if (teamUsers.length === 0 && allUsers.length > 0) {
        teamUsers = allUsers; // If only current user is in DB
      }
    } else {
      // Team leader: direct reports where mentorId matches
      const mentees = allUsers.filter(u => u.mentorId === currentUser.id);
      if (mentees.length > 0) {
        teamUsers = mentees;
        isDirectReportsOnly = true;
      } else {
        // Fallback: non-admin users so the team leader doesn't see an empty screen if mentorId wasn't set yet
        teamUsers = allUsers.filter(u => u.id !== currentUser.id && u.role !== 'admin');
      }
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
      };
    }

    // 2. Fetch all self-reviews
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
          const currentStatus = selfReviewsByMember.get(memberId);
          // prioritize submitted/completed over draft
          if (d.status === 'submitted' || d.status === 'completed') {
            selfReviewsByMember.set(memberId, 'submitted');
          } else if (d.status === 'draft' && currentStatus !== 'submitted') {
            selfReviewsByMember.set(memberId, 'draft');
          }
        }
      });
    }

    // 3. Fetch all peer-review-assignments
    const assignmentsSnap = await adminDb.collection('peer-review-assignments')
      .get()
      .catch(() => null);

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

    // 4. Fetch any saved insights or AI evaluations
    const insightsSnap = await adminDb.collection('team-insights')
      .get()
      .catch(() => null);

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

    // 5. Build TeamMemberFeedback objects
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

      const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

      return {
        id: user.id,
        name: user.name,
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
    };
  }
}

/**
 * Fetches detailed review information for a specific team member.
 */
export async function getTeamMemberDetailAction(memberId: string): Promise<TeamMemberDetail | null> {
  await requireLeaderOrAdminSession();

  try {
    const userDoc = await adminDb.collection('users').doc(memberId).get();
    if (!userDoc.exists) {
      return null;
    }
    const member = { id: userDoc.id, ...userDoc.data() } as User;

    // Fetch member's self-review
    const selfReviewSnap = await adminDb.collection('reviews')
      .where('type', '==', 'self')
      .where('revieweeId', '==', memberId)
      .limit(1)
      .get()
      .catch(() => null);

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
    const peerAssignedSnap = await adminDb.collection('peer-review-assignments')
      .where('reviewerId', '==', memberId)
      .get()
      .catch(() => null);

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
    const peerReceivedSnap = await adminDb.collection('peer-review-assignments')
      .where('revieweeId', '==', memberId)
      .get()
      .catch(() => null);

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
