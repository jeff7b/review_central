
"use client";

import { ReviewForm } from '@/components/reviews/review-form';
import type { Question, Answer, Review } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Mock data for questions - in a real app, this would come from the specific questionnaire
const mockSelfReviewQuestions: Question[] = [
  { id: 'q1', text: 'What were your major accomplishments in the last review period?', order: 1 },
  { id: 'q2', text: 'What are some areas where you faced challenges, and how did you address them?', order: 2 },
  { id: 'q3', text: 'What are your key strengths, and how did you leverage them?', order: 3 },
  { id: 'q4', text: 'What are your areas for development, and what steps will you take to improve?', order: 4 },
  { id: 'q5', text: 'What are your goals for the next review period?', order: 5 },
];

// Mock existing review data - in a real app, fetch this based on params.id
const mockExistingReview: Review = {
  id: 'sr2', // Example ID, this would match the one from the dashboard
  title: 'Mid-Year Self-Review 2024',
  type: 'self',
  status: 'draft',
  dueDate: '2024-07-30',
  questionnaireId: 'q2',
  questions: mockSelfReviewQuestions,
  answers: [
    { questionId: 'q1', answerText: 'Launched the new product feature ahead of schedule.' },
    { questionId: 'q2', answerText: 'Faced initial technical hurdles with API integration, resolved by collaborating with the backend team.' },
    { questionId: 'q3', answerText: '' }, // Example of an unanswered or partially answered question
    { questionId: 'q4', answerText: '' },
    { questionId: 'q5', answerText: 'Lead the next phase of the project and mentor a junior developer.' },
  ],
  createdAt: '2024-07-01T10:00:00Z',
  updatedAt: '2024-07-05T14:30:00Z',
};


export default function EditSelfReviewPage() {
  const router = useRouter();
  const params = useParams();
  const reviewId = params.id as string;

  const [reviewData, setReviewData] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching review data
    // In a real app, you would fetch reviewData based on reviewId
    if (reviewId) {
      // For now, we'll just use the mockExistingReview if the ID matches
      // Or you could have a list of mock reviews and find the one with reviewId
      if (reviewId === mockExistingReview.id) {
        setReviewData(mockExistingReview);
      } else {
        // Handle case where review is not found, e.g. redirect or show error
        // For now, let's use a generic set of questions if no specific review is "found"
        // This part would be more robust in a real fetch
        setReviewData({
            id: reviewId,
            title: `Self-Review ID: ${reviewId}`,
            type: 'self',
            status: 'draft',
            questions: mockSelfReviewQuestions,
            answers: [],
            questionnaireId: 'q_generic',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
      }
      setIsLoading(false);
    }
  }, [reviewId]);

  const handleSubmitEditReview = (answers: Answer[]) => {
    console.log(`Edited self-review (ID: ${reviewId}) submitted:`, answers);
    // Here you would typically send the updated data to your backend
    router.push('/dashboard');
    // Add toast notification for success
  };

  const handleSaveDraftEditReview = (answers: Answer[]) => {
    console.log(`Edited self-review draft (ID: ${reviewId}) saved:`, answers);
    // Implement draft saving logic for updates
    // Add toast notification for draft saved
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <p>Loading review data...</p>
      </div>
    );
  }

  if (!reviewData) {
     return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <p>Review not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <Link href="/dashboard" className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <span className="mr-1">←</span> Back to Dashboard
        </Link>
      </div>
      <ReviewForm
        reviewType="self"
        questions={reviewData.questions}
        initialAnswers={reviewData.answers}
        onSubmit={handleSubmitEditReview}
        onSaveDraft={handleSaveDraftEditReview}
        formTitle={`Edit Self-Review: ${reviewData.title}`}
        formDescription="Update your responses below. Your feedback is valuable for your growth and development."
      />
    </div>
  );
}
