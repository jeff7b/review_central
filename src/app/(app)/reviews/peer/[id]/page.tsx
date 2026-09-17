"use client";

import { useEffect, useState } from 'react';
import { ReviewForm } from '@/components/reviews/review-form';
import type { Question, Answer, PeerReviewAssignment } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getPeerReviewAssignmentAction, submitPeerReviewAction } from '@/app/(app)/reviews/actions';
import { useToast } from '@/hooks/use-toast';

export default function SubmitPeerReviewPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<PeerReviewAssignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [initialAnswers, setInitialAnswers] = useState<Answer[]>([]);
  const [formTitle, setFormTitle] = useState('Peer Review');
  const [formDescription, setFormDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadAssignment() {
      if (!assignmentId) return;
      try {
        setIsLoading(true);
        const res = await getPeerReviewAssignmentAction(assignmentId);
        setAssignment(res.assignment);
        setQuestions(res.questions);
        setInitialAnswers(res.initialAnswers);
        setFormTitle(`Peer Review for ${res.assignment.revieweeName}`);
        setFormDescription(
          res.questionnaire?.description ||
          `Please provide constructive and specific feedback for ${res.assignment.revieweeName}. Your insights are valuable for their development.`
        );
      } catch (error) {
        console.error('Failed to load peer review assignment:', error);
        toast({
          variant: 'destructive',
          title: 'Error loading assignment',
          description: 'Could not fetch the peer review assignment.',
        });
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    }
    loadAssignment();
  }, [assignmentId, router, toast]);

  const handleSubmitPeerReview = async (answers: Answer[]) => {
    try {
      await submitPeerReviewAction({
        assignmentId,
        answers,
        isDraft: false,
      });
      toast({
        title: 'Review submitted',
        description: `Your peer review for ${assignment?.revieweeName} has been submitted.`,
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error submitting peer review:', error);
      toast({
        variant: 'destructive',
        title: 'Error submitting review',
        description: error.message || 'Could not submit your review.',
      });
    }
  };
  
  const handleSaveDraft = async (answers: Answer[]) => {
    try {
      await submitPeerReviewAction({
        assignmentId,
        answers,
        isDraft: true,
      });
      toast({
        title: 'Draft saved',
        description: 'Your responses have been saved as draft.',
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
        <p className="text-xs text-muted-foreground">Loading peer review questionnaire...</p>
      </div>
    );
  }

  if (!assignment) {
    return null;
  }

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
        initialAnswers={initialAnswers}
        revieweeName={assignment.revieweeName}
        onSubmit={handleSubmitPeerReview}
        onSaveDraft={handleSaveDraft}
        formTitle={formTitle}
        formDescription={formDescription}
      />
    </div>
  );
}
