"use client";

import { ReviewForm } from '@/components/reviews/review-form';
import type { Question, Answer } from '@/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Mock data for questions - in a real app, this would come from a questionnaire template
const mockSelfReviewQuestions: Question[] = [
  { id: 'q1', text: 'What were your major accomplishments in the last review period?', order: 1 },
  { id: 'q2', text: 'What are some areas where you faced challenges, and how did you address them?', order: 2 },
  { id: 'q3', text: 'What are your key strengths, and how did you leverage them?', order: 3 },
  { id: 'q4', text: 'What are your areas for development, and what steps will you take to improve?', order: 4 },
  { id: 'q5', text: 'What are your goals for the next review period?', order: 5 },
];

export default function NewSelfReviewPage() {
  const router = useRouter();

  const handleSubmitSelfReview = (answers: Answer[]) => {
    console.log('Self-review submitted:', answers);
    // Here you would typically send the data to your backend
    // After successful submission, navigate or show a success message
    // For now, let's navigate back to the dashboard
    router.push('/dashboard'); 
    // Add toast notification for success
  };

  const handleSaveDraft = (answers: Answer[]) => {
    console.log('Self-review draft saved:', answers);
    // Implement draft saving logic
    // Add toast notification for draft saved
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <Link href="/dashboard" className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <span className="mr-1">←</span> Back to Dashboard
        </Link>
      </div>
      <ReviewForm
        reviewType="self"
        questions={mockSelfReviewQuestions}
        onSubmit={handleSubmitSelfReview}
        onSaveDraft={handleSaveDraft}
        formTitle="New Self-Review"
        formDescription="Please provide thoughtful and honest responses to the questions below. Your feedback is valuable for your growth and development."
      />
    </div>
  );
}
