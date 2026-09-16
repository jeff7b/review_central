"use client";

import { Suspense, useEffect, useState } from 'react';
import { ReviewForm } from '@/components/reviews/review-form';
import type { Question, Answer, Questionnaire, ReviewCycle } from '@/types';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getNewSelfReviewContextAction, submitSelfReviewAction } from '@/app/(app)/reviews/actions';
import { useToast } from '@/hooks/use-toast';

function SelfReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get('cycleId') || undefined;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [activeCycle, setActiveCycle] = useState<ReviewCycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadContext() {
      try {
        setIsLoading(true);
        const res = await getNewSelfReviewContextAction(cycleId);
        setQuestions(res.questions);
        setQuestionnaire(res.questionnaire);
        setActiveCycle(res.activeCycle);
      } catch (error) {
        console.error('Failed to load self-review context:', error);
        toast({
          variant: 'destructive',
          title: 'Error loading questionnaire',
          description: 'Could not fetch the self-review questionnaire.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadContext();
  }, [cycleId, toast]);

  const handleSubmitSelfReview = async (answers: Answer[]) => {
    try {
      await submitSelfReviewAction({
        title: activeCycle ? `${activeCycle.name} Self-Review` : (questionnaire?.name || 'Self-Review'),
        questionnaireId: questionnaire?.id,
        questions,
        answers,
        isDraft: false,
        reviewCycleId: activeCycle?.id,
        dueDate: activeCycle?.endDate,
      });
      toast({
        title: 'Self-review submitted',
        description: 'Your self-evaluation has been submitted successfully.',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error submitting self-review:', error);
      toast({
        variant: 'destructive',
        title: 'Error submitting review',
        description: error.message || 'Could not submit your self-review.',
      });
    }
  };

  const handleSaveDraft = async (answers: Answer[]) => {
    try {
      await submitSelfReviewAction({
        title: activeCycle ? `${activeCycle.name} Self-Review` : (questionnaire?.name || 'Self-Review'),
        questionnaireId: questionnaire?.id,
        questions,
        answers,
        isDraft: true,
        reviewCycleId: activeCycle?.id,
        dueDate: activeCycle?.endDate,
      });
      toast({
        title: 'Draft saved',
        description: 'Your self-review responses have been saved as draft.',
      });
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast({
        variant: 'destructive',
        title: 'Error saving draft',
        description: error.message || 'Could not save draft.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading self-review questions...</p>
      </div>
    );
  }

  const title = activeCycle ? `${activeCycle.name} Self-Review` : (questionnaire?.name || 'New Self-Review');
  const description = questionnaire?.description || "Please provide thoughtful and honest responses to the questions below. Your feedback is valuable for your growth and development.";

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
        onSubmit={handleSubmitSelfReview}
        onSaveDraft={handleSaveDraft}
        formTitle={title}
        formDescription={description}
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
