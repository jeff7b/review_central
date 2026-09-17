"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  CheckCircle2,
  Edit3,
  FileText,
  Users,
  PlusCircle,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowUpRight,
  NotebookPen,
  History,
  Trash2,
  Search,
  Award,
  Sparkles,
  Plus,
  Loader2,
  CalendarClock,
  ExternalLink,
  Radio,
  Check,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  Lock,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useLiveMentorFeedback } from '@/hooks/use-live-mentor-feedback';
import { getMemberFeedbackProfileAction } from '@/app/(app)/team-dashboard/member/[id]/actions';
import type { Review, PersonalNote, HistoricalEvaluation, ReviewCycle, QuestionFeedbackCollation } from '@/types';
import { getDashboardDataAction, savePersonalNoteAction, deletePersonalNoteAction } from './actions';
import { useToast } from '@/hooks/use-toast';

const getStatusBadge = (status: Review['status'], isOverdue: boolean) => {
  if (isOverdue) {
    return (
      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 font-medium text-xs">
        <AlertTriangle className="mr-1 h-3 w-3 text-rose-600" /> Overdue
      </Badge>
    );
  }
  switch (status) {
    case 'submitted':
    case 'completed':
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium text-xs">
          <CheckCircle className="mr-1 h-3 w-3 text-emerald-600" /> Submitted
        </Badge>
      );
    case 'draft':
      return (
        <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 font-medium text-xs">
          Draft
        </Badge>
      );
    case 'pending_submission':
      return (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400 font-medium text-xs">
          Pending
        </Badge>
      );
    default:
      return <Badge variant="secondary" className="text-xs">{((status || '') as string).replace('_', ' ')}</Badge>;
  }
};

const getCategoryBadge = (category: PersonalNote['category']) => {
  switch (category) {
    case 'achievement':
      return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400 text-[11px] font-medium">Achievement</Badge>;
    case 'goal':
      return <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-400 text-[11px] font-medium">Goal</Badge>;
    case 'meeting':
      return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400 text-[11px] font-medium">1:1 Sync</Badge>;
    case 'reflection':
      return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400 text-[11px] font-medium">Reflection</Badge>;
  }
};

const ReviewCard = ({ review }: { review: Review }) => {
  const isOverdue = review.dueDate && new Date(review.dueDate) < new Date() && review.status !== 'completed' && review.status !== 'submitted';

  const isStartNew = review.type === 'self' && (review.id.startsWith('cycle-invitation-') || review.id.startsWith('self-task-'));
  const actionHref = review.type === 'self' 
    ? (isStartNew
        ? `/reviews/self/new?cycleId=${review.reviewCycleId || review.id.replace('cycle-invitation-', '').replace('self-task-', '')}`
        : (review.status === 'draft' || review.status === 'pending_submission' ? `/reviews/self/${review.id}/edit` : `/reviews/self/${review.id}`))
    : `/reviews/peer/${review.assignmentId || review.id}`;

  return (
    <Card className="border border-border bg-card shadow-sm hover:border-border/80 hover:shadow transition-all flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {review.type === 'self' ? 'Self Assessment' : `Peer Review`}
            </span>
            <CardTitle className="text-base font-semibold font-headline line-clamp-1">
              {review.title}
            </CardTitle>
          </div>
          {getStatusBadge(review.status, !!isOverdue)}
        </div>
        {review.reviewee && (
          <p className="text-xs text-muted-foreground pt-1">
            Subject: <span className="font-medium text-foreground">{review.reviewee.name}</span>
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3 pb-3">
        <div className="flex items-center text-xs text-muted-foreground gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span>Due date:</span>
          <span className="font-medium text-foreground">
            {review.dueDate ? new Date(review.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {review.status === 'draft' ? 'Draft saved. Resume editing to complete submission.' : 
           review.status === 'pending_submission' ? 'Assignment pending. Complete before the specified deadline.' :
           review.status === 'submitted' || review.status === 'completed' ? 'Successfully recorded. Under review.' :
           'Pending your feedback.'}
        </p>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border/50 flex justify-end">
        {(review.status === 'draft' || review.status === 'pending_submission') && (
          <Button asChild size="sm" className="h-8 text-xs font-medium">
            <Link href={actionHref}>
              {review.status === 'draft' ? <Edit3 className="mr-1.5 h-3.5 w-3.5" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
              {review.status === 'draft' ? 'Continue Draft' : 'Start Review'}
            </Link>
          </Button>
        )}
        {(review.status === 'submitted' || review.status === 'completed') && (
          <Button variant="outline" size="sm" className="h-8 text-xs font-medium text-muted-foreground" disabled>
            <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Submitted
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default function DashboardPage() {
  const [selfReviews, setSelfReviews] = useState<Review[]>([]);
  const [peerReviewsAssigned, setPeerReviewsAssigned] = useState<Review[]>([]);
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [feedbackHistory, setFeedbackHistory] = useState<HistoricalEvaluation[]>([]);
  const [reviewCycles, setReviewCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Live Mentor Feedback state for the employee
  const [activeEmployeeId, setActiveEmployeeId] = useState<string>('');
  const {
    feedback: liveMentorFeedback,
    isLoading: isMentorFeedbackLoading,
    saveFeedback: saveMentorFeedbackFromEmployee,
    isConnected: isMentorSyncConnected,
    isSyncing: isMentorSyncing,
    lastSyncedAt: mentorLastSyncedAt,
  } = useLiveMentorFeedback({
    employeeId: activeEmployeeId,
    role: 'employee',
  });

  const handleToggleEmployeeActionItem = (itemId: string) => {
    if (!liveMentorFeedback) return;
    const updated = (liveMentorFeedback.actionItems || []).map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    saveMentorFeedbackFromEmployee({ actionItems: updated }, true);
  };

  // Collated peer feedback received (strictly anonymous, only approved answers)
  const [rawCollatedQuestions, setRawCollatedQuestions] = useState<QuestionFeedbackCollation[]>([]);
  const [showPeerFeedback, setShowPeerFeedback] = useState(false);

  useEffect(() => {
    async function loadReceivedPeerFeedback() {
      try {
        const data = await getMemberFeedbackProfileAction(activeEmployeeId, selectedCycleId);
        if (data?.collatedQuestions) {
          setRawCollatedQuestions(data.collatedQuestions);
        }
      } catch (err) {
        console.error('Failed to load received feedback questions:', err);
      }
    }
    if (activeEmployeeId) {
      loadReceivedPeerFeedback();
    }
  }, [activeEmployeeId, selectedCycleId]);

  // Filter collated questions to ONLY include mentor-approved responses and apply live mentor edits
  const receivedQuestions = useMemo<QuestionFeedbackCollation[]>(() => {
    // If master peer feedback sharing is disabled, or no approved responses exist, return empty
    if (!liveMentorFeedback?.isPeerFeedbackShared && (liveMentorFeedback?.approvedResponseIds || []).length === 0) {
      return [];
    }

    const approvedIds = new Set<string>(liveMentorFeedback?.approvedResponseIds || []);
    const editedMap = liveMentorFeedback?.editedResponses || {};

    return rawCollatedQuestions
      .map((q) => {
        const approvedPeerAnswers = q.peerAnswers
          .filter((p) => p.id && approvedIds.has(p.id))
          .map((p) => {
            const respId = p.id || '';
            const editedText = respId ? editedMap[respId] : undefined;
            return {
              ...p,
              answerText: editedText || p.answerText,
              isEdited: !!editedText && editedText !== p.originalAnswerText,
            };
          });

        return {
          ...q,
          peerAnswers: approvedPeerAnswers,
          isApprovedForSharing: approvedPeerAnswers.length > 0,
        };
      })
      .filter((q) => q.peerAnswers.length > 0);
  }, [rawCollatedQuestions, liveMentorFeedback?.isPeerFeedbackShared, liveMentorFeedback?.approvedResponseIds, liveMentorFeedback?.editedResponses]);

  // Notes state
  const [noteSearch, setNoteSearch] = useState('');
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<PersonalNote['category']>('achievement');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const { toast } = useToast();

  const fetchDashboardData = async (cycleId?: string) => {
    try {
      setIsLoading(true);
      const data = await getDashboardDataAction(cycleId);
      setSelfReviews(data.selfReviews);
      setPeerReviewsAssigned(data.peerReviewsAssigned);
      setNotes(data.notes);
      setFeedbackHistory(data.feedbackHistory);
      setReviewCycles(data.reviewCycles);
      setSelectedCycleId(data.selectedCycleId);
      if (data.currentUser?.id) {
        setActiveEmployeeId(data.currentUser.id);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading dashboard',
        description: 'Could not fetch your latest review data.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCycleChange = (newCycleId: string) => {
    setSelectedCycleId(newCycleId);
    fetchDashboardData(newCycleId);
  };

  const selectedCycle = reviewCycles.find(c => c.id === selectedCycleId);
  const allReviews = [...selfReviews, ...peerReviewsAssigned];
  const pendingCount = allReviews.filter(r => r.status === 'draft' || r.status === 'pending_submission').length;
  const completedCount = allReviews.filter(r => r.status === 'submitted' || r.status === 'completed').length;
  const overdueCount = allReviews.filter(r => r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'completed' && r.status !== 'submitted').length;

  const filteredNotes = (notes || []).filter(n => {
    const searchLower = (noteSearch || '').toLowerCase();
    const titleMatch = (n?.title || '').toLowerCase().includes(searchLower);
    const contentMatch = (n?.content || '').toLowerCase().includes(searchLower);
    return titleMatch || contentMatch;
  });

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSavingNote(true);
      const saved = await savePersonalNoteAction({
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        date: new Date().toISOString().split('T')[0],
      });

      setNotes([saved, ...notes]);
      setNewTitle('');
      setNewContent('');
      setNewCategory('achievement');
      setIsAddNoteOpen(false);
      toast({
        title: 'Note saved',
        description: 'Your personal note has been saved.',
      });
    } catch (error: any) {
      console.error('Failed to save note:', error);
      toast({
        variant: 'destructive',
        title: 'Error saving note',
        description: error.message || 'Could not save your note.',
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deletePersonalNoteAction(id);
      setNotes(notes.filter(n => n.id !== id));
      toast({
        title: 'Note deleted',
        description: 'The personal note has been removed.',
      });
    } catch (error: any) {
      console.error('Failed to delete note:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete the note.',
      });
    }
  };

  const startReviewHref = selectedCycleId ? `/reviews/self/new?cycleId=${selectedCycleId}` : '/reviews/self/new';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">My Dashboard</h1>
          <p className="text-xs text-muted-foreground">Manage your performance self-evaluations, assigned peer reviews, personal notes, and feedback history</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Review Cycle Selector Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:inline-block" />
            <Select value={selectedCycleId} onValueChange={handleCycleChange} disabled={isLoading || reviewCycles.length === 0}>
              <SelectTrigger className="w-full sm:w-[240px] h-9 text-xs font-medium">
                <SelectValue placeholder="Select Review Cycle..." />
              </SelectTrigger>
              <SelectContent>
                {reviewCycles.map(cycle => (
                  <SelectItem key={cycle.id} value={cycle.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span>{cycle.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        cycle.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {cycle.status}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button asChild size="sm" className="h-9 font-medium shadow-sm shrink-0">
            <Link href={startReviewHref}>
              <PlusCircle className="mr-1.5 h-4 w-4" /> Start New Self-Review
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-xs text-muted-foreground">Loading your dashboard data...</p>
        </div>
      ) : (
        <>
          {/* Cycle Info Bar */}
          {selectedCycle && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-3.5 py-2 rounded-lg border border-border/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{selectedCycle.name}</span>
                <Badge variant="outline" className={`text-[10px] py-0 px-1.5 capitalize font-medium ${
                  selectedCycle.status === 'active' 
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                    : ''
                }`}>
                  {selectedCycle.status}
                </Badge>
              </div>
              <div className="text-muted-foreground text-[11px] flex items-center gap-3">
                <span>Period: {new Date(selectedCycle.startDate).toLocaleDateString()} – {new Date(selectedCycle.endDate).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          {/* KPI Metric Summary Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Pending Action</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{pendingCount}</span>
                <span className="text-xs text-muted-foreground">reviews</span>
              </div>
            </Card>

            <Card className="p-4 border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Completed</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{completedCount}</span>
                <span className="text-xs text-muted-foreground">submitted</span>
              </div>
            </Card>

            <Card className="p-4 border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Overdue</span>
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                  {overdueCount}
                </span>
                <span className="text-xs text-muted-foreground">needs attention</span>
              </div>
            </Card>

            <Card className="p-4 border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Completion Rate</span>
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {allReviews.length > 0 ? Math.round((completedCount / allReviews.length) * 100) : 0}%
                </span>
                <span className="text-xs text-muted-foreground">overall</span>
              </div>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="self-reviews" className="w-full space-y-4">
            <TabsList className="bg-muted p-1 rounded-lg border border-border/50 flex flex-wrap sm:inline-flex w-full sm:w-auto h-auto gap-1">
              <TabsTrigger value="self-reviews" className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> My Self-Reviews ({selfReviews.length})
              </TabsTrigger>
              <TabsTrigger value="peer-reviews" className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Users className="mr-1.5 h-3.5 w-3.5" /> Peer Reviews Assigned ({peerReviewsAssigned.length})
              </TabsTrigger>
              <TabsTrigger value="my-notes" className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <NotebookPen className="mr-1.5 h-3.5 w-3.5" /> My Notes ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="feedback-history" className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <History className="mr-1.5 h-3.5 w-3.5" /> Feedback History ({feedbackHistory.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Self-Reviews */}
            <TabsContent value="self-reviews" className="mt-4">
              {selfReviews.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {selfReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12 border-dashed">
                  <CardContent>
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="text-sm font-semibold text-foreground">No self-reviews found</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      {selectedCycle 
                        ? `You have no active self-review drafts or submissions for ${selectedCycle.name}.`
                        : "You have no active self-review drafts or submissions."}
                    </p>
                    <Button asChild size="sm">
                      <Link href={startReviewHref}>Start New Self-Review</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB 2: Peer Reviews Assigned */}
            <TabsContent value="peer-reviews" className="mt-4">
              {peerReviewsAssigned.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {peerReviewsAssigned.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12 border-dashed">
                  <CardContent>
                    <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="text-sm font-semibold text-foreground">No peer reviews assigned</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedCycle 
                        ? `You have no peer review assignments for ${selectedCycle.name}.`
                        : "You will be notified when peer evaluations are assigned to you."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB 3: My Notes */}
            <TabsContent value="my-notes" className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notes & milestones..."
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-9 text-xs font-medium shadow-sm">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleCreateNote}>
                      <DialogHeader>
                        <DialogTitle className="text-base font-semibold font-headline">New Performance Note</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                          Capture achievements, 1:1 discussion points, or personal goals to reference during review cycles.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">Title</label>
                          <Input
                            placeholder="e.g. Completed Q3 Service Refactor"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="h-9 text-xs"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">Category</label>
                          <select
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value as PersonalNote['category'])}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="achievement">Achievement</option>
                            <option value="meeting">1:1 Sync / Meeting</option>
                            <option value="goal">Goal / OKR</option>
                            <option value="reflection">Self Reflection</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">Details / Notes</label>
                          <Textarea
                            placeholder="Summarize key details, impact, deliverables, or manager feedback..."
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            className="text-xs min-h-[100px]"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsAddNoteOpen(false)} className="text-xs h-8" disabled={isSavingNote}>
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" className="text-xs h-8" disabled={isSavingNote}>
                          {isSavingNote && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                          Save Note
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {filteredNotes.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredNotes.map((note) => (
                    <Card key={note.id} className="border border-border bg-card shadow-sm hover:shadow transition-all flex flex-col justify-between">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          {getCategoryBadge(note.category)}
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(note.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <CardTitle className="text-sm font-semibold font-headline pt-1 line-clamp-1">
                          {note.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </CardContent>
                      <CardFooter className="pt-2 pb-3 border-t border-border/40 flex justify-between items-center text-xs text-muted-foreground">
                        <span className="text-[11px]">Private note</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                          onClick={() => handleDeleteNote(note.id)}
                          title="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12 border-dashed">
                  <CardContent>
                    <NotebookPen className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="text-sm font-semibold text-foreground">No notes found</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      {noteSearch ? "No notes matching your search filter." : "Keep a running log of achievements and reflections to make review time effortless."}
                    </p>
                    <Button size="sm" onClick={() => setIsAddNoteOpen(true)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Your First Note
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB 4: Feedback History */}
            <TabsContent value="feedback-history" className="mt-4 space-y-6">
              {/* FEEDBACK RECEIVED: Active 1:1 Live Mentor Feedback & Shared Notes */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1 border-b border-border/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold font-headline text-foreground">
                        Feedback Received — Active 1:1 Mentor Session & Shared Notes
                      </h2>
                      <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 bg-primary/5 text-primary">
                        <Sparkles className="mr-1 h-3 w-3" /> Live Session
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Shared performance feedback, discussion notes, and agreed commitments provided by your Mentor / Team Lead. Updates in real-time during your 1:1 or Teams meeting.
                    </p>
                  </div>

                  {/* Real-time sync badge */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Badge
                      variant="outline"
                      className={`text-xs px-2.5 py-1 font-medium gap-1.5 ${
                        isMentorSyncConnected
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isMentorSyncConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                      <span>{isMentorSyncConnected ? 'Live Sync Active' : 'Connecting...'}</span>
                      {isMentorSyncing && <RefreshCw className="h-3 w-3 animate-spin ml-0.5" />}
                    </Badge>
                  </div>
                </div>

                {isMentorFeedbackLoading ? (
                  <Card className="border border-border/60 bg-card shadow-sm p-8 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">Loading 1:1 Mentor Feedback session...</p>
                        <p className="text-[11px] text-muted-foreground">Connecting to real-time feedback stream</p>
                      </div>
                    </div>
                  </Card>
                ) : liveMentorFeedback && liveMentorFeedback.isShared ? (
                  <Card className="border border-primary/20 bg-card shadow-sm overflow-hidden ring-1 ring-primary/10">
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 via-primary to-indigo-500" />
                    <CardHeader className="pb-3 border-b border-border/40 bg-primary/5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                            {liveMentorFeedback.mentorAvatarUrl ? (
                              <AvatarImage src={liveMentorFeedback.mentorAvatarUrl} alt={liveMentorFeedback.mentorName} />
                            ) : null}
                            <AvatarFallback className="text-xs font-bold">
                              {liveMentorFeedback.mentorName.split(' ').map((n) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm font-semibold font-headline">
                                {liveMentorFeedback.mentorName}
                              </CardTitle>
                              <Badge variant="outline" className="text-[10px] border-border font-medium">
                                {liveMentorFeedback.mentorRole || 'Mentor & Team Lead'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {selectedCycle?.name || liveMentorFeedback.cycleName || 'Active Review Cycle'}
                            </p>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[11px] text-muted-foreground block">
                            Last live update:
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            {mentorLastSyncedAt
                              ? mentorLastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              : new Date(liveMentorFeedback.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-6 space-y-5">
                      {/* Shared Live Notes Area */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-primary" />
                          1:1 Discussion Notes & Mentor Performance Feedback
                        </h4>
                        <div className="p-4 rounded-lg bg-muted/40 border border-border/50 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                          {liveMentorFeedback.sharedNotes ? (
                            liveMentorFeedback.sharedNotes
                          ) : (
                            <span className="italic text-muted-foreground">
                              Your mentor is currently typing feedback. Notes will appear here live...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Items Checklist */}
                      {liveMentorFeedback.actionItems && liveMentorFeedback.actionItems.length > 0 && (
                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                              Agreed Action Items & Development Milestones
                            </h4>
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {liveMentorFeedback.actionItems.filter((a) => a.completed).length} / {liveMentorFeedback.actionItems.length} completed
                            </span>
                          </div>

                          <div className="space-y-2">
                            {liveMentorFeedback.actionItems.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => handleToggleEmployeeActionItem(item.id)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                                  item.completed
                                    ? 'bg-muted/40 border-border/40 text-muted-foreground line-through'
                                    : 'bg-card border-border hover:border-primary/50'
                                }`}
                              >
                                <div
                                  className={`h-4 w-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                                    item.completed
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'border-muted-foreground/50'
                                  }`}
                                >
                                  {item.completed && <Check className="h-3 w-3" />}
                                </div>
                                <span className="leading-snug select-none">{item.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Strengths & Growth Areas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {liveMentorFeedback.strengths && liveMentorFeedback.strengths.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Award className="h-3.5 w-3.5 text-emerald-600" /> Strengths Recognized
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {liveMentorFeedback.strengths.map((str) => (
                                <Badge
                                  key={str}
                                  variant="outline"
                                  className="text-[11px] font-normal py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                >
                                  {str}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {liveMentorFeedback.growthAreas && liveMentorFeedback.growthAreas.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5 text-blue-600" /> Focus Areas for Growth
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {liveMentorFeedback.growthAreas.map((area) => (
                                <Badge
                                  key={area}
                                  variant="outline"
                                  className="text-[11px] font-normal py-0.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                >
                                  {area}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="p-3 bg-muted/20 border-t border-border/40 flex justify-between items-center text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Radio className="h-3 w-3 text-emerald-600" />
                        <span>Shared live notes area during your 1:1 meeting. Updates stream live without refreshing.</span>
                      </div>
                      <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-primary">
                        <Link href={`/team-dashboard/member/${activeEmployeeId}${selectedCycleId ? `?cycleId=${selectedCycleId}` : ''}`} target="_blank">
                          <ExternalLink className="mr-1 h-3 w-3" /> View Member Profile
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ) : (
                  <Card className="border-dashed p-6 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <h3 className="text-sm font-semibold text-foreground">Waiting for 1:1 Session to Begin</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Once your Mentor / Team Lead starts your 1:1 session or shares feedback, it will appear here in real time.
                    </p>
                  </Card>
                )}

                {/* ANONYMOUS PEER FEEDBACK RECEIVED (COLLATED BY QUESTION) */}
                {receivedQuestions.length > 0 ? (
                  <Card className="border border-border bg-card shadow-sm mt-4">
                    <CardHeader
                      onClick={() => setShowPeerFeedback(!showPeerFeedback)}
                      className="p-4 cursor-pointer select-none bg-muted/20 hover:bg-muted/30 transition-colors border-b border-border/40 flex flex-row items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-semibold font-headline flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-primary" />
                            Collated Peer Feedback Received ({receivedQuestions.length} Question{receivedQuestions.length !== 1 ? 's' : ''})
                          </CardTitle>
                          <Badge variant="outline" className="text-[10px] font-medium border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" /> 100% Anonymous
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-medium border-primary/30 bg-primary/5 text-primary flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5 text-primary" /> Mentor Approved
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Anonymous peer feedback curated and approved by your mentor for this cycle, grouped by question.
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0">
                        {showPeerFeedback ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CardHeader>

                    {showPeerFeedback && (
                      <CardContent className="p-4 sm:p-6 space-y-5">
                        <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground flex items-center gap-2">
                          <Lock className="h-4 w-4 text-primary shrink-0" />
                          <span>
                            <strong>Anonymous Feedback Policy:</strong> Peer feedback is aggregated question-by-question without reviewer names or identifiable attributes to ensure candid, authentic growth discussions. Only mentor-approved feedback is visible.
                          </span>
                        </div>

                        <div className="space-y-4">
                          {receivedQuestions.map((q) => (
                            <div key={q.questionId} className="rounded-lg border border-border/70 bg-card p-4 space-y-3">
                              <div className="flex items-start gap-2.5">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                                  Q{q.order}
                                </span>
                                <div className="space-y-0.5">
                                  {q.category && (
                                    <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                                      {q.category}
                                    </Badge>
                                  )}
                                  <h4 className="text-xs font-semibold text-foreground">{q.questionText}</h4>
                                </div>
                              </div>

                              {/* Self Answer */}
                              {q.selfAnswer && (
                                <div className="pl-8 text-xs p-2.5 rounded bg-emerald-50/20 border border-emerald-200/50 text-foreground">
                                  <span className="font-semibold text-emerald-800 dark:text-emerald-300 block text-[11px] mb-0.5">
                                    Your Self-Assessment:
                                  </span>
                                  <p className="italic text-foreground/90">&ldquo;{q.selfAnswer}&rdquo;</p>
                                </div>
                              )}

                              {/* Anonymous Peer Answers */}
                              <div className="pl-8 space-y-2 pt-1">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                  Anonymous Peer Responses ({q.peerAnswers.length})
                                </span>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {q.peerAnswers.map((peer, pIdx) => (
                                    <div
                                      key={peer.id || pIdx}
                                      className="p-3 rounded-md border border-border/50 bg-muted/20 space-y-1.5 text-xs"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                                            <Lock className="h-3 w-3 text-muted-foreground" />
                                            Anonymous Peer #{pIdx + 1}
                                          </span>
                                          {peer.isEdited && (
                                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                              Edited by Mentor
                                            </Badge>
                                          )}
                                        </div>
                                        {peer.sentiment && (
                                          <Badge
                                            variant="outline"
                                            className={`text-[9px] py-0 px-1.5 ${
                                              peer.sentiment === 'positive'
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                : peer.sentiment === 'constructive'
                                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                : 'border-slate-200 bg-slate-100 text-slate-700'
                                            }`}
                                          >
                                            {peer.sentiment === 'positive' ? 'Positive' : peer.sentiment === 'constructive' ? 'Growth' : 'Neutral'}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-muted-foreground italic text-[11px] leading-relaxed">
                                        &ldquo;{peer.answerText}&rdquo;
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ) : (
                  <Card className="border-dashed p-5 text-center mt-4 bg-muted/10">
                    <Lock className="mx-auto h-7 w-7 text-muted-foreground mb-2" />
                    <h3 className="text-xs font-semibold text-foreground">Peer Feedback Under Mentor Review</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-md mx-auto">
                      Anonymous peer reviews for this cycle are currently being curated and approved by your mentor. Approved feedback will appear here once released.
                    </p>
                  </Card>
                )}
              </div>

              <Separator className="my-6" />

              {/* Past Review Cycles History Heading */}
              <div className="space-y-1">
                <h3 className="text-sm font-bold font-headline text-foreground">
                  Past Review Cycles & Historical Evaluations
                </h3>
                <p className="text-xs text-muted-foreground">
                  Official evaluations, performance ratings, and peer feedback summaries from previous completed review cycles.
                </p>
              </div>

              {feedbackHistory.length > 0 ? (
                <div className="space-y-4">
                  {feedbackHistory.map((item) => (
                    <Card key={item.id} className="border border-border bg-card shadow-sm hover:border-border/80 transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[11px] font-medium border-border">
                                {item.type}
                              </Badge>
                              {item.period && <span className="text-xs text-muted-foreground">• {item.period}</span>}
                            </div>
                            <CardTitle className="text-base font-semibold font-headline">
                              {item.cycleTitle}
                            </CardTitle>
                          </div>

                          {item.overallRating && (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-xs font-semibold px-2.5 py-1 ${
                                  item.ratingTier === 'exceeds'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400'
                                }`}
                              >
                                <Award className="mr-1.5 h-3.5 w-3.5" />
                                {item.overallRating}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3 text-muted-foreground" />
                          <span>Evaluator:</span>
                          <span className="font-medium text-foreground">{item.reviewer.startsWith('Anonymous') ? item.reviewer : 'Anonymous Reviewer'}</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300">
                            Anonymous
                          </Badge>
                          <span>• Completed on {new Date(item.completedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4 pt-1 pb-4">
                        {item.summary && (
                          <div className="rounded-md bg-muted/40 border border-border/50 p-3">
                            <h4 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-primary" /> Evaluation Summary
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.summary}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {item.keyStrengths && item.keyStrengths.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Key Strengths Recognized
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {item.keyStrengths.map((str) => (
                                  <Badge key={str} variant="secondary" className="text-[11px] font-normal py-0.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {str}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.growthAreas && item.growthAreas.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Focus Areas For Growth
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {item.growthAreas.map((area) => (
                                  <Badge key={area} variant="outline" className="text-[11px] font-normal py-0.5 border-border text-muted-foreground">
                                    {area}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12 border-dashed">
                  <CardContent>
                    <History className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="text-sm font-semibold text-foreground">No feedback history yet</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Past performance evaluations and completed peer feedback summaries will appear here once review cycles conclude.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
