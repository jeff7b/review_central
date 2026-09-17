'use server';

import { getMemberFeedbackProfile, saveMentorFeedback } from '@/lib/mentor-feedback-service';
import type { MentorFeedback } from '@/types';

export async function getMemberFeedbackProfileAction(employeeId: string) {
  return await getMemberFeedbackProfile(employeeId);
}

export async function saveMentorFeedbackAction(feedback: Partial<MentorFeedback> & { employeeId: string }) {
  return await saveMentorFeedback(feedback);
}
