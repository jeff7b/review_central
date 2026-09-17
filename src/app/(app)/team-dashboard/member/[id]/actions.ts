'use server';

import { getMemberFeedbackProfile, saveMentorFeedback } from '@/lib/mentor-feedback-service';
import type { MentorFeedback } from '@/types';

export async function getMemberFeedbackProfileAction(employeeId: string, cycleId?: string) {
  return await getMemberFeedbackProfile(employeeId, cycleId);
}

export async function saveMentorFeedbackAction(feedback: Partial<MentorFeedback> & { employeeId: string }) {
  return await saveMentorFeedback(feedback);
}

export async function togglePeerResponseApprovalAction(params: {
  employeeId: string;
  responseId: string;
  isApproved: boolean;
}) {
  const current = await getMemberFeedbackProfile(params.employeeId);
  const currentApproved = new Set<string>(current.mentorFeedback?.approvedResponseIds || []);

  if (params.isApproved) {
    currentApproved.add(params.responseId);
  } else {
    currentApproved.delete(params.responseId);
  }

  return await saveMentorFeedback({
    employeeId: params.employeeId,
    approvedResponseIds: Array.from(currentApproved),
  });
}

export async function savePeerResponseEditAction(params: {
  employeeId: string;
  responseId: string;
  editedText: string;
}) {
  const current = await getMemberFeedbackProfile(params.employeeId);
  const currentEdits = { ...(current.mentorFeedback?.editedResponses || {}) };

  if (params.editedText.trim()) {
    currentEdits[params.responseId] = params.editedText.trim();
  } else {
    delete currentEdits[params.responseId];
  }

  return await saveMentorFeedback({
    employeeId: params.employeeId,
    editedResponses: currentEdits,
  });
}
