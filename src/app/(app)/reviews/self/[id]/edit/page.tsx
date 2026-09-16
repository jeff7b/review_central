"use client";

import { ReviewForm } from '@/components/reviews/review-form';
import type { Question, Answer, Review, Questionnaire, ReviewCycle } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSelfReviewDataAction, saveSelfReviewAction } from '../../../actions';

const fallbackQuestions: Question[] = [
  { id: 'q1', text: 'What were your major accomplishments in the last review period?', order: 1 },
  { id: 'q2', text: 'What are some areas where you faced challenges, and how did you address them?', order: 2 },
  { id: 'q3', text: 'What are your key strengths, and how did you leverage them?', order: 3 },
  { id: 'q4', text: 'What are your areas for development, and what steps will you take to improve?', order: 4 },
  { id: 'q5', text: 'What are your goals for the next review period?', order: 5 },
];

export default function EditSelfReviewPage() {
  const router = useRouter();
  const params = useParams();
  const reviewId = params.id as string;
  const { toast } = useToast();

  const [reviewData, setReviewData] = useState<Review | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [cycle, setCycle] = useState<ReviewCycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!reviewId) return;
      try {
        setIsLoading(true);
        const data = await getSelfReviewDataAction({ reviewId });
        setReviewData(data.existingReview);
        setQuestionnaire(data.questionnaire);
        setCycle(data.reviewCycle);
      } catch (err) {
        console.error('Failed to load review data:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not load review data.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [reviewId, toast]);

  const questions =
    (questionnaire?.questions?.length && questionnaire.questions) ||
    (reviewData?.questions?.length && reviewData.questions) ||
    fallbackQuestions;

  const handleSubmitEditReview = async (answers: Answer[]) => {
    try {
      setIsSaving(true);
      await saveSelfReviewAction({
        reviewId,
        reviewCycleId: cycle?.id || reviewData?.reviewCycleId || null,
        questionnaireId: questionnaire?.id || reviewData?.questionnaireId || 'default-self',
        answers,
        isDraft: false,
      });
      toast({
        title: 'Self-Review Submitted',
        description: 'Your self-assessment has been successfully submitted.',
      });
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to submit review:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not submit review.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraftEditReview = async (answers: Answer[]) => {
    try {
      setIsSaving(true);
      await saveSelfReviewAction({
        reviewId,
        reviewCycleId: cycle?.id || reviewData?.reviewCycleId || null,
        questionnaireId: questionnaire?.id || reviewData?.questionnaireId || 'default-self',
        answers,
        isDraft: true,
      });
      toast({
        title: 'Draft Saved',
        description: 'Your changes have been saved.',
      });
    } catch (err) {
      console.error('Failed to save draft:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save draft.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reviewData) {
    return (
      <div className="text-center py-20">
        <h3 className="text-base font-semibold text-foreground">Review not found</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">The requested self-review could not be located.</p>
        <Button asChild size="sm">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const formTitle = cycle ? `${cycle.name} - Self-Review` : (reviewData.title || 'Edit Self-Review');

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <Link href="/dashboard" className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <span className="mr-1">←</span> Back to Dashboard
        </Link>
      </div>
      <ReviewForm
        reviewType="self"
        questions={questions}
        initialAnswers={reviewData.answers || []}
        onSubmit={handleSubmitEditReview}
        onSaveDraft={handleSaveDraftEditReview}
        formTitle={formTitle}
        formDescription={questionnaire?.description || "Update your responses below. Your feedback is valuable for your growth and development."}
      />
    </div>
  );
}
