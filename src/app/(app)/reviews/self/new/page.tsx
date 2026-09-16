"use client";

import { Suspense, useState, useEffect } from 'react';
import { ReviewForm } from '@/components/reviews/review-form';
import type { Question, Answer, Questionnaire, ReviewCycle, Review } from '@/types';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSelfReviewDataAction, saveSelfReviewAction } from '../../actions';

const fallbackQuestions: Question[] = [
  { id: 'q1', text: 'What were your major accomplishments in the last review period?', order: 1 },
  { id: 'q2', text: 'What are some areas where you faced challenges, and how did you address them?', order: 2 },
  { id: 'q3', text: 'What are your key strengths, and how did you leverage them?', order: 3 },
  { id: 'q4', text: 'What are your areas for development, and what steps will you take to improve?', order: 4 },
  { id: 'q5', text: 'What are your goals for the next review period?', order: 5 },
];

function SelfReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get('cycleId') || undefined;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [cycle, setCycle] = useState<ReviewCycle | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const data = await getSelfReviewDataAction({ cycleId });
        setCycle(data.reviewCycle);
        setQuestionnaire(data.questionnaire);
        setExistingReview(data.existingReview);
      } catch (err) {
        console.error('Failed to load self review questions:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not load self-review questions. Using standard template.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [cycleId, toast]);

  const questions = questionnaire?.questions?.length ? questionnaire.questions : fallbackQuestions;

  const handleSubmitSelfReview = async (answers: Answer[]) => {
    if (!questionnaire && !questions.length) return;
    try {
      setIsSaving(true);
      await saveSelfReviewAction({
        reviewId: existingReview?.id,
        reviewCycleId: cycle?.id || cycleId || null,
        questionnaireId: questionnaire?.id || 'default-self',
        answers,
        isDraft: false,
      });
      toast({
        title: 'Self-Review Submitted',
        description: 'Your self-assessment has been successfully submitted.',
      });
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to submit self review:', err);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: 'Could not submit your review. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async (answers: Answer[]) => {
    try {
      setIsSaving(true);
      const res = await saveSelfReviewAction({
        reviewId: existingReview?.id,
        reviewCycleId: cycle?.id || cycleId || null,
        questionnaireId: questionnaire?.id || 'default-self',
        answers,
        isDraft: true,
      });
      if (res?.reviewId && !existingReview?.id) {
        setExistingReview(prev => (prev ? { ...prev, id: res.reviewId } : ({ id: res.reviewId } as Review)));
      }
      toast({
        title: 'Draft Saved',
        description: 'Your draft has been saved. You can complete it anytime.',
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

  const formTitle = cycle ? `${cycle.name} - Self-Review` : (questionnaire?.name || 'Self-Review');

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
        initialAnswers={existingReview?.answers || []}
        onSubmit={handleSubmitSelfReview}
        onSaveDraft={handleSaveDraft}
        formTitle={formTitle}
        formDescription={questionnaire?.description || "Please provide thoughtful and honest responses to the questions below. Your feedback is valuable for your growth and development."}
      />
    </div>
  );
}

export default function NewSelfReviewPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <SelfReviewContent />
    </Suspense>
  );
}
