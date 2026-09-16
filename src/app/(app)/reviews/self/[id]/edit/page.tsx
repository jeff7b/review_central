"use client";

import { useEffect, useState } from 'react';
import { ReviewForm } from '@/components/reviews/review-form';
import type { Answer, Review } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getSelfReviewAction, submitSelfReviewAction } from '@/app/(app)/reviews/actions';
import { useToast } from '@/hooks/use-toast';

export default function EditSelfReviewPage() {
  const router = useRouter();
  const params = useParams();
  const reviewId = params.id as string;
  const { toast } = useToast();

  const [reviewData, setReviewData] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReview() {
      if (!reviewId) return;
      try {
        setIsLoading(true);
        const res = await getSelfReviewAction(reviewId);
        setReviewData(res.review);
      } catch (error) {
        console.error('Failed to load self-review:', error);
        toast({
          variant: 'destructive',
          title: 'Review not found',
          description: 'Could not load the requested self-review.',
        });
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    }
    loadReview();
  }, [reviewId, router, toast]);

  const handleSubmitEditReview = async (answers: Answer[]) => {
    if (!reviewData) return;
    try {
      await submitSelfReviewAction({
        id: reviewData.id,
        title: reviewData.title,
        questionnaireId: reviewData.questionnaireId,
        questions: reviewData.questions,
        answers,
        isDraft: false,
        dueDate: reviewData.dueDate,
      });
      toast({
        title: 'Self-review submitted',
        description: 'Your changes and responses have been successfully submitted.',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Failed to submit self-review:', error);
      toast({
        variant: 'destructive',
        title: 'Submission failed',
        description: error.message || 'Could not submit your self-review.',
      });
    }
  };

  const handleSaveDraftEditReview = async (answers: Answer[]) => {
    if (!reviewData) return;
    try {
      await submitSelfReviewAction({
        id: reviewData.id,
        title: reviewData.title,
        questionnaireId: reviewData.questionnaireId,
        questions: reviewData.questions,
        answers,
        isDraft: true,
        dueDate: reviewData.dueDate,
      });
      toast({
        title: 'Draft saved',
        description: 'Your self-review draft has been saved.',
      });
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save draft',
        description: error.message || 'Could not save draft.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading self-review data...</p>
      </div>
    );
  }

  if (!reviewData) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm font-semibold">Review not found.</p>
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
        initialAnswers={reviewData.answers || []}
        onSubmit={handleSubmitEditReview}
        onSaveDraft={handleSaveDraftEditReview}
        formTitle={`Edit: ${reviewData.title}`}
        formDescription="Update your responses below. Your feedback is valuable for your growth and development."
      />
    </div>
  );
}
