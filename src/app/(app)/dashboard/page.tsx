"use client";

import { useState, useEffect } from 'react';
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
  CheckCircle,
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
  ExternalLink,
  Loader2,
} from 'lucide-react';
import type { Review } from '@/types';
import { getUserDashboardDataAction } from './actions';

// Note Structure
interface PersonalNote {
  id: string;
  title: string;
  content: string;
  category: 'achievement' | 'goal' | 'meeting' | 'reflection';
  date: string;
}

const initialNotes: PersonalNote[] = [
  {
    id: 'note-1',
    title: 'Q3 Technical Architecture Milestone',
    content: 'Completed migration of the identity auth middleware ahead of schedule. Received positive recognition from team lead during sprint retro.',
    category: 'achievement',
    date: '2024-08-18',
  },
  {
    id: 'note-2',
    title: '1:1 Sync with Manager (Career Path)',
    content: 'Discussed career growth path towards Tech Lead. Agreed focus areas for next quarter: cross-team mentorship and leading system architecture documentation.',
    category: 'meeting',
    date: '2024-07-22',
  },
  {
    id: 'note-3',
    title: 'OKR Goal: Improve Unit Test Coverage',
    content: 'Increased unit test coverage for core service actions to 85%. Automated test pipeline run time reduced by 20% following test parallelization.',
    category: 'goal',
    date: '2024-06-14',
  },
];

// Feedback History Structure
interface HistoricalEvaluation {
  id: string;
  cycleTitle: string;
  period: string;
  completedDate: string;
  type: 'Annual Performance Review' | 'Mid-Year Review' | '360 Peer Evaluation';
  overallRating: string;
  ratingTier: 'exceeds' | 'meets' | 'high';
  reviewer: string;
  reviewerRole: string;
  summary: string;
  keyStrengths: string[];
  growthAreas: string[];
}

const mockFeedbackHistory: HistoricalEvaluation[] = [
  {
    id: 'hist-1',
    cycleTitle: 'FY2023 Annual Performance Cycle',
    period: 'Jan 2023 - Dec 2023',
    completedDate: '2023-12-15',
    type: 'Annual Performance Review',
    overallRating: 'Exceeds Expectations',
    ratingTier: 'exceeds',
    reviewer: 'Diana Prince',
    reviewerRole: 'Engineering Director',
    summary: 'Demonstrated exceptional technical leadership and execution on high-priority deliverables. Maintained strong cross-functional collaboration across engineering, product, and QA teams.',
    keyStrengths: ['Technical Architecture', 'Sprint Delivery Speed', 'Cross-team Collaboration'],
    growthAreas: ['External Tech Speaking & Knowledge Sharing'],
  },
  {
    id: 'hist-2',
    cycleTitle: 'FY2023 Mid-Year Check-In',
    period: 'Jan 2023 - Jun 2023',
    completedDate: '2023-06-28',
    type: 'Mid-Year Review',
    overallRating: 'Strong Contributor',
    ratingTier: 'high',
    reviewer: 'Diana Prince',
    reviewerRole: 'Engineering Director',
    summary: 'Consistently met sprint commitments with high code quality. Proactively identified and remediated critical technical debt in legacy data models.',
    keyStrengths: ['Code Quality & Rigor', 'Root Cause Debugging', 'Reliability'],
    growthAreas: ['Proactive Stakeholder Status Updates'],
  },
  {
    id: 'hist-3',
    cycleTitle: 'FY2022 Q4 360 Peer Review',
    period: 'Oct 2022 - Dec 2022',
    completedDate: '2022-11-20',
    type: '360 Peer Evaluation',
    overallRating: 'Positive Consensus (94%)',
    ratingTier: 'exceeds',
    reviewer: '4 Peer Evaluators (Aggregated)',
    reviewerRole: 'Peer Group',
    summary: 'Peers consistently highlighted rapid PR turnaround times, approachable mentorship style, and willingness to pair program through complex production blockers.',
    keyStrengths: ['Peer Mentorship', 'Rapid Code Reviews', 'Approachability'],
    growthAreas: ['Documentation of Implicit Assumptions'],
  },
];

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
      return <Badge variant="secondary" className="text-xs">{(status as string).replace('_', ' ')}</Badge>;
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
            <Link
              href={
                review.type === 'self'
                  ? review.id.startsWith('self-task-')
                    ? `/reviews/self/new?cycleId=${review.reviewCycleId}`
                    : `/reviews/self/${review.id}/edit`
                  : `/reviews/peer/${review.assignmentId || review.id}`
              }
            >
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
  const [isLoading, setIsLoading] = useState(true);
  const [selfReviews, setSelfReviews] = useState<Review[]>([]);
  const [peerReviews, setPeerReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({
    pendingCount: 0,
    completedCount: 0,
    overdueCount: 0,
    completionRate: 0,
  });

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const data = await getUserDashboardDataAction();
      setSelfReviews(data.selfReviews);
      setPeerReviews(data.peerReviews);
      setStats({
        pendingCount: data.pendingCount,
        completedCount: data.completedCount,
        overdueCount: data.overdueCount,
        completionRate: data.completionRate,
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Notes state
  const [notes, setNotes] = useState<PersonalNote[]>(initialNotes);
  const [noteSearch, setNoteSearch] = useState('');
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<PersonalNote['category']>('achievement');

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(noteSearch.toLowerCase()) ||
    n.content.toLowerCase().includes(noteSearch.toLowerCase())
  );

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newNote: PersonalNote = {
      id: `note-${Date.now()}`,
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      date: new Date().toISOString().split('T')[0],
    };

    setNotes([newNote, ...notes]);
    setNewTitle('');
    setNewContent('');
    setNewCategory('achievement');
    setIsAddNoteOpen(false);
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">My Dashboard</h1>
          <p className="text-xs text-muted-foreground">Manage your performance self-evaluations, assigned peer reviews, personal notes, and feedback history</p>
        </div>
        <Button asChild size="sm" className="h-9 font-medium shadow-sm">
          <Link href="/reviews/self/new">
            <PlusCircle className="mr-1.5 h-4 w-4" /> Start New Self-Review
          </Link>
        </Button>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Pending Action</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{stats.pendingCount}</span>
            <span className="text-xs text-muted-foreground">reviews</span>
          </div>
        </Card>

        <Card className="p-4 border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Completed</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{stats.completedCount}</span>
            <span className="text-xs text-muted-foreground">submitted</span>
          </div>
        </Card>

        <Card className="p-4 border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Overdue</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
              {stats.overdueCount}
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
              {stats.completionRate}%
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
            <Users className="mr-1.5 h-3.5 w-3.5" /> Peer Reviews Assigned ({peerReviews.length})
          </TabsTrigger>
          <TabsTrigger value="my-notes" className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <NotebookPen className="mr-1.5 h-3.5 w-3.5" /> My Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="feedback-history" className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <History className="mr-1.5 h-3.5 w-3.5" /> Feedback History ({mockFeedbackHistory.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Self-Reviews */}
        <TabsContent value="self-reviews" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : selfReviews.length > 0 ? (
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
                <p className="text-xs text-muted-foreground mt-1 mb-4">You have no active self-review drafts or submissions.</p>
                <Button asChild size="sm">
                  <Link href="/reviews/self/new">Start New Self-Review</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: Peer Reviews Assigned */}
        <TabsContent value="peer-reviews" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : peerReviews.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {peerReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12 border-dashed">
              <CardContent>
                <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No peer reviews assigned</h3>
                <p className="text-xs text-muted-foreground mt-1">You will be notified when peer evaluations are assigned to you.</p>
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
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsAddNoteOpen(false)} className="text-xs h-8">
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="text-xs h-8">
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
                  <CardContent className="pb-3 text-xs text-muted-foreground leading-relaxed">
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
        <TabsContent value="feedback-history" className="mt-4 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs text-muted-foreground">
              Official evaluations, performance ratings, and peer feedback summaries from previous performance cycles.
            </p>
          </div>

          <div className="space-y-4">
            {mockFeedbackHistory.map((item) => (
              <Card key={item.id} className="border border-border bg-card shadow-sm hover:border-border/80 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px] font-medium border-border">
                          {item.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">• {item.period}</span>
                      </div>
                      <CardTitle className="text-base font-semibold font-headline">
                        {item.cycleTitle}
                      </CardTitle>
                    </div>

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
                  </div>

                  <p className="text-xs text-muted-foreground pt-1">
                    Evaluator: <span className="font-medium text-foreground">{item.reviewer}</span> ({item.reviewerRole}) • Completed on {new Date(item.completedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4 pt-1 pb-4">
                  <div className="rounded-md bg-muted/40 border border-border/50 p-3">
                    <h4 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Evaluation Summary
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
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
                  </div>
                </CardContent>

                <CardFooter className="pt-2 pb-3 border-t border-border/50 flex justify-end">
                  <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-primary hover:text-primary">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View Full Record
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
