"use client";

import { ReviewForm } from '@/components/reviews/review-form';
import type { Question, Answer, PeerReviewAssignment, ReviewCycle, Questionnaire, Review } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPeerReviewDataAction, savePeerReviewAction } from '../../actions';

const fallbackQuestions: Question[] = [
  { id: 'pq1', text: 'How has this peer contributed to team goals?', order: 1 },
  { id: 'pq2', text: 'Describe a situation where this peer demonstrated strong collaboration skills.', order: 2 },
  { id: 'pq3', text: 'What are this peer\'s key strengths from your perspective?', order: 3 },
  { id: 'pq4', text: 'In what areas could this peer potentially improve or develop further?', order: 4 },
  { id: 'pq5', text: 'Provide any additional feedback you think would be helpful.', order: 5 },
];

export default function SubmitPeerReviewPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [assignment, setAssignment] = useState<PeerReviewAssignment | null>(null);
  const [cycle, setCycle] = useState<ReviewCycle | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!assignmentId) return;
      try {
        setIsLoading(true);
        const data = await getPeerReviewDataAction(assignmentId);
        setAssignment(data.assignment);
        setCycle(data.reviewCycle);
        setQuestionnaire(data.questionnaire);
        setExistingReview(data.existingReview);
      } catch (err: any) {
        console.error('Failed to load peer review data:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: err.message || 'Could not load peer review assignment.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [assignmentId, toast]);

  const questions =
    (questionnaire?.questions?.length && questionnaire.questions) ||
    (existingReview?.questions?.length && existingReview.questions) ||
    fallbackQuestions;

  const handleSubmitPeerReview = async (answers: Answer[]) => {
    try {
      setIsSaving(true);
      await savePeerReviewAction({
        assignmentId,
        answers,
        isDraft: false,
      });
      toast({
        title: 'Peer Review Submitted',
        description: `Your feedback for ${assignment?.revieweeName || 'peer'} has been recorded.`,
      });
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Failed to submit peer review:', err);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: err.message || 'Could not submit peer review.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async (answers: Answer[]) => {
    try {
      setIsSaving(true);
      await savePeerReviewAction({
        assignmentId,
        answers,
        isDraft: true,
      });
      toast({
        title: 'Draft Saved',
        description: 'Your progress has been saved. You can resume anytime.',
      });
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Could not save draft.',
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

  if (!assignment) {
    return (
      <div className="text-center py-20">
        <h3 className="text-base font-semibold text-foreground">Assignment Not Found</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">The assigned peer review could not be found or you do not have permission to view it.</p>
        <Button asChild size="sm">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const revieweeName = assignment.revieweeName;
  const formTitle = `Peer Review for ${revieweeName}`;
  const formDescription = questionnaire?.description || `Please provide constructive and specific feedback for ${revieweeName}. Your insights are valuable for their professional development.`;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <Link href="/dashboard" className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <span className="mr-1">←</span> Back to Dashboard
        </Link>
      </div>
      <ReviewForm
        reviewType="peer"
        questions={questions}
        revieweeName={revieweeName}
        initialAnswers={existingReview?.answers || []}
        onSubmit={handleSubmitPeerReview}
        onSaveDraft={handleSaveDraft}
        formTitle={formTitle}
        formDescription={formDescription}
      />
    </div>
  );
}
