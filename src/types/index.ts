
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'employee' | 'team_leader' | 'admin';
  mentorId?: string | null;
  adminReviewerId?: string | null;
}


export interface Question {
  id: string;
  text: string;
  order: number;
}

export interface Answer {
  questionId: string;
  answerText: string;
}

export interface Review {
  id: string;
  title: string;
  type: 'self' | 'peer';
  status: 'draft' | 'pending_submission' | 'submitted' | 'completed'; // pending_submission for peer reviews assigned but not started
  dueDate?: string;
  reviewee?: User; // Person being reviewed
  reviewer?: User; // Person writing the review (relevant for peer reviews)
  questionnaireId: string;
  questions: Question[];
  answers?: Answer[];
  reviewCycleId?: string;
  assignmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberFeedback {
  id: string; // user id
  name: string;
  avatarUrl?: string;
  selfReviewStatus: 'not_started' | 'draft' | 'submitted';
  peerReviewsAssignedCount: number;
  peerReviewsCompletedCount: number;
  // AI Insights
  feedbackSummary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  keyImprovementAreas?: string[];
}

export interface Questionnaire {
  id: string; // Unique ID for this specific version
  templateId: string; // Groups all versions of a questionnaire
  version: number;
  name: string;
  description?: string;
  type: 'self' | 'peer';
  questions: Question[];
  isActive: boolean; // True if this is the latest, assignable version
  createdAt: string; // ISO string format
  updatedAt: string; // ISO string format
}

export interface PeerReviewAssignment {
  id: string;
  reviewCycleId: string;
  revieweeId: string;
  revieweeName: string;
  revieweeAvatarUrl?: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatarUrl?: string;
  questionnaireId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'declined';
  dueDate: string; // ISO string format
  reviewId?: string; // Link to the actual review once submitted
  createdAt: string; // ISO string format
  updatedAt: string; // ISO string format
}

export interface ReviewCycle {
  id: string;
  name: string;
  startDate: string; // ISO string format
  endDate: string; // ISO string format
  participantIds: string[]; // Array of user IDs
  status: 'draft' | 'active' | 'closed';
  selfReviewQuestionnaireId?: string | null;
  peerReviewQuestionnaireId?: string | null;
  createdAt: string; // ISO string format
  updatedAt: string; // ISO string format
}

export interface MentorFeedbackActionItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface MentorFeedback {
  id: string;
  employeeId: string;
  employeeName: string;
  mentorId: string;
  mentorName: string;
  mentorRole?: string;
  cycleId?: string;
  cycleName?: string;
  sharedNotes: string;
  strengths: string[];
  growthAreas: string[];
  actionItems: MentorFeedbackActionItem[];
  isShared: boolean; // Master toggle for shared 1:1 notes
  isPeerFeedbackShared?: boolean; // Master toggle for sharing anonymous peer reviews with the employee
  approvedResponseIds?: string[]; // IDs of approved peer responses
  editedResponses?: Record<string, string>; // Map of responseId -> mentor-edited text
  lastUpdated: string;
  status: 'draft' | 'in_meeting' | 'finalized';
}

export interface PeerQuestionResponse {
  id?: string; // Unique identifier for response tracking and editing (generated or persisted)
  reviewerId: string;
  reviewerName: string;
  reviewerAvatarUrl?: string;
  reviewerRole?: string;
  answerText: string; // Effective answer text (mentor edited if available, else original)
  originalAnswerText?: string; // Original peer submission text
  isEdited?: boolean;
  isApproved?: boolean; // Approved by mentor to be shared with employee
  sentiment?: 'positive' | 'neutral' | 'constructive';
  submittedAt?: string;
}

export interface QuestionFeedbackCollation {
  questionId: string;
  questionText: string;
  order: number;
  category?: string;
  selfAnswer?: string;
  selfAnswerSubmittedAt?: string;
  peerAnswers: PeerQuestionResponse[];
  isApprovedForSharing?: boolean; // Convenience flag indicating whether any answers are approved
}

export interface PersonalNote {
  id: string;
  userId?: string;
  title: string;
  content: string;
  category: 'achievement' | 'goal' | 'meeting' | 'reflection';
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HistoricalEvaluation {
  id: string;
  cycleTitle: string;
  period: string;
  completedDate: string;
  type: string;
  overallRating?: string;
  ratingTier?: 'exceeds' | 'meets' | 'high';
  reviewer: string;
  reviewerRole: string;
  summary: string;
  keyStrengths: string[];
  growthAreas: string[];
}
