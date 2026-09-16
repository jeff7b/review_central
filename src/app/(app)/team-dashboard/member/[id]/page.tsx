"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  Users
} from 'lucide-react';
import { getTeamMemberDetailAction, type TeamMemberDetail } from '../../actions';
import { useToast } from '@/hooks/use-toast';

export default function TeamMemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;
  const [detail, setDetail] = useState<TeamMemberDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      if (!memberId) return;
      try {
        setIsLoading(true);
        const res = await getTeamMemberDetailAction(memberId);
        if (!res) {
          toast({
            variant: 'destructive',
            title: 'Member not found',
            description: 'Could not find the requested team member.',
          });
          router.push('/team-dashboard');
          return;
        }
        setDetail(res);
      } catch (error) {
        console.error('Error fetching member detail:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load team member profile.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [memberId, router, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading team member details...</p>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const { member, selfReview, peerReviewsAssigned, peerReviewsReceived } = detail;
  const peerCompletedCount = peerReviewsAssigned.filter(a => a.status === 'completed').length;
  const peerProgressPercent = peerReviewsAssigned.length > 0
    ? Math.round((peerCompletedCount / peerReviewsAssigned.length) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground hover:text-foreground">
          <Link href="/team-dashboard">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Team Dashboard
          </Link>
        </Button>
      </div>

      {/* Member Profile Header Card */}
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16 ring-2 ring-border">
                <AvatarImage src={member.avatarUrl} alt={member.name} />
                <AvatarFallback className="text-lg font-bold">
                  {(member.name || 'User').split(' ').filter(Boolean).map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h1 className="text-xl font-bold font-headline text-foreground">{member.name || 'User'}</h1>
                <p className="text-xs text-muted-foreground">{member.email || 'No email'}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className="text-xs capitalize font-medium">
                    {(member.role || 'employee').replace('_', ' ')}
                  </Badge>
                  {selfReview?.status === 'submitted' ? (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs">
                      <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> Self-Review Submitted
                    </Badge>
                  ) : selfReview?.status === 'draft' ? (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-xs">
                      <Clock className="mr-1 h-3 w-3 text-amber-600" /> Self-Review In Draft
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-xs">
                      <ShieldAlert className="mr-1 h-3 w-3 text-rose-600" /> Self-Review Not Started
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Quick KPI stats */}
            <div className="flex sm:flex-col items-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 w-full sm:w-auto">
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Peer Feedback Progress</span>
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <span className="text-lg font-bold text-foreground">
                    {peerCompletedCount} / {peerReviewsAssigned.length}
                  </span>
                  <span className="text-xs text-muted-foreground">({peerProgressPercent}%)</span>
                </div>
              </div>
              <Progress value={peerProgressPercent} className="w-32 h-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Member Detail */}
      <Tabs defaultValue="self-review" className="w-full space-y-4">
        <TabsList className="bg-muted p-1 rounded-lg border border-border/50 flex flex-wrap sm:inline-flex w-full sm:w-auto h-auto gap-1">
          <TabsTrigger value="self-review" className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Self-Review
          </TabsTrigger>
          <TabsTrigger value="peer-assigned" className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Peer Reviews Assigned ({peerReviewsAssigned.length})
          </TabsTrigger>
          <TabsTrigger value="peer-received" className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Feedback Received ({peerReviewsReceived.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Self-Review Details */}
        <TabsContent value="self-review" className="space-y-4">
          {selfReview ? (
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold font-headline">{selfReview.title}</CardTitle>
                    <CardDescription className="text-xs">
                      Status: <span className="font-medium text-foreground capitalize">{selfReview.status}</span>
                      {selfReview.dueDate && ` • Due: ${new Date(selfReview.dueDate).toLocaleDateString()}`}
                    </CardDescription>
                  </div>
                  {selfReview.status === 'submitted' ? (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                      Submitted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">
                      Draft
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {selfReview.questions && selfReview.questions.length > 0 ? (
                  selfReview.questions.map((q, idx) => {
                    const ans = selfReview.answers?.find(a => a.questionId === q.id)?.answerText;
                    return (
                      <div key={q.id} className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-semibold text-foreground leading-tight">{q.text}</h4>
                        </div>
                        <div className="pl-7 pt-1">
                          <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {ans && ans.trim() ? ans : <span className="text-muted-foreground italic">No response provided.</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">No questions recorded for this self-review.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-12 border-dashed">
              <CardContent>
                <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No self-review recorded</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  This team member has not yet started their self-review submission.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: Peer Reviews Assigned */}
        <TabsContent value="peer-assigned" className="space-y-4">
          {peerReviewsAssigned.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {peerReviewsAssigned.map((a) => (
                <Card key={a.id} className="border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase">Evaluating</span>
                      <h4 className="text-sm font-semibold text-foreground">{a.revieweeName}</h4>
                    </div>
                    <Badge variant="outline" className={`text-xs capitalize ${
                      a.status === 'completed'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : a.status === 'in_progress'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}>
                      {a.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12 border-dashed">
              <CardContent>
                <UserCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No peer reviews assigned</h3>
                <p className="text-xs text-muted-foreground mt-1">This member has not been assigned any peer evaluations.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: Feedback Received */}
        <TabsContent value="peer-received" className="space-y-4">
          {peerReviewsReceived.length > 0 ? (
            <div className="space-y-4">
              {peerReviewsReceived.map((rev, idx) => (
                <Card key={idx} className="border border-border bg-card">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Peer Feedback</span>
                        <CardTitle className="text-sm font-semibold">From: {rev.reviewerName}</CardTitle>
                      </div>
                      <Badge variant="outline" className={`text-xs capitalize ${
                        rev.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}>
                        {rev.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {rev.answers && rev.answers.length > 0 ? (
                      rev.answers.map((ans, aIdx) => (
                        <div key={aIdx} className="rounded bg-muted/30 p-3 text-xs space-y-1">
                          <span className="font-semibold text-foreground">Response {aIdx + 1}</span>
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{ans.answerText}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Evaluation in progress or pending submission.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12 border-dashed">
              <CardContent>
                <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No peer feedback received yet</h3>
                <p className="text-xs text-muted-foreground mt-1">Completed evaluations by colleagues will appear here.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
