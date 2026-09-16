"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Question, Answer, Review } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Save, Send, AlertCircle, CheckCircle2, UserCheck, FileText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ReviewFormProps {
  reviewType: 'self' | 'peer';
  questions: Question[];
  initialAnswers?: Answer[];
  revieweeName?: string; // For peer reviews
  onSubmit: (answers: Answer[]) => void;
  onSaveDraft?: (answers: Answer[]) => void;
  formTitle: string;
  formDescription?: string;
}

export function ReviewForm({
  reviewType,
  questions,
  initialAnswers = [],
  revieweeName,
  onSubmit,
  onSaveDraft,
  formTitle,
  formDescription,
}: ReviewFormProps) {
  const [answers, setAnswers] = useState<Answer[]>(
    questions.map(q => {
      const existingAnswer = initialAnswers.find(a => a.questionId === q.id);
      return { questionId: q.id, answerText: existingAnswer?.answerText || '' };
    })
  );
  const [showConfirmation, setShowConfirmation] = useState(false);

  const answeredCount = answers.filter(a => a.answerText.trim() !== '').length;
  const isAllAnswered = questions.length > 0 && answeredCount === questions.length;
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const handleAnswerChange = (questionId: string, text: string) => {
    setAnswers(prevAnswers =>
      prevAnswers.map(ans =>
        ans.questionId === questionId ? { ...ans, answerText: text } : ans
      )
    );
    if (showConfirmation) setShowConfirmation(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllAnswered) {
      setShowConfirmation(true);
      return;
    }
    onSubmit(answers);
  };
  
  const handleSaveDraft = () => {
    if (onSaveDraft) {
      onSaveDraft(answers);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto border border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 pb-5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <Badge variant="outline" className="text-xs font-medium border-primary/30 bg-primary/5 text-primary">
            {reviewType === 'self' ? <FileText className="mr-1 h-3 w-3" /> : <UserCheck className="mr-1 h-3 w-3" />}
            {reviewType === 'self' ? 'Self Assessment' : 'Peer Evaluation'}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">
            {answeredCount} of {questions.length} questions completed ({progressPercent}%)
          </span>
        </div>
        <CardTitle className="text-xl font-bold font-headline">{formTitle}</CardTitle>
        {formDescription && <CardDescription className="text-xs">{formDescription}</CardDescription>}
        {reviewType === 'peer' && revieweeName && (
          <div className="mt-2 rounded-md bg-muted/40 p-2.5 border border-border/50 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Subject being evaluated:</span>
            <span className="text-xs font-semibold text-foreground">{revieweeName}</span>
          </div>
        )}
        <div className="pt-2">
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.sort((a,b) => a.order - b.order).map((question, index) => {
            const currentAnswer = answers.find(ans => ans.questionId === question.id)?.answerText || '';
            const isAnswered = currentAnswer.trim().length > 0;

            return (
              <div key={question.id} className="rounded-lg border border-border/70 bg-card p-4 space-y-3 transition-colors hover:border-border">
                <div className="flex items-start gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isAnswered ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                    {isAnswered ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <div className="space-y-1 flex-1">
                    <Label htmlFor={`question-${question.id}`} className="text-sm font-semibold text-foreground leading-snug cursor-pointer">
                      {question.text}
                    </Label>
                  </div>
                </div>
                
                <div className="pl-9">
                  <Textarea
                    id={`question-${question.id}`}
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Provide constructive, specific examples and context..."
                    rows={4}
                    className="text-xs resize-y min-h-[90px] border-border"
                  />
                  <div className="flex justify-end pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {currentAnswer.length} characters
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          
          {showConfirmation && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">Incomplete Questionnaire</AlertTitle>
              <AlertDescription className="text-xs">
                Please provide an answer for all questions before submitting. You can save your draft at any time.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              {isAllAnswered ? 'All questions answered. Ready to submit.' : `${questions.length - answeredCount} question(s) remaining`}
            </span>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {onSaveDraft && (
                <Button type="button" variant="outline" size="sm" onClick={handleSaveDraft} className="w-full sm:w-auto text-xs font-medium h-9">
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Save Draft
                </Button>
              )}
              <Button type="submit" size="sm" className="w-full sm:w-auto text-xs font-medium h-9 shadow-sm">
                <Send className="mr-1.5 h-3.5 w-3.5" /> Submit Review
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
