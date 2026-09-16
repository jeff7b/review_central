"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  Users,
  Eye,
  FileText,
  UserCheck,
  Send,
  Plus,
  Trash2,
  Radio,
  Share2,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Columns,
  ListFilter,
  Search,
  Award,
  TrendingUp,
  Calendar,
  Layers,
  ThumbsUp,
  AlertCircle,
  Lock,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLiveMentorFeedback } from '@/hooks/use-live-mentor-feedback';
import { getMemberFeedbackProfileAction } from './actions';
import type { QuestionFeedbackCollation, MentorFeedback, MentorFeedbackActionItem } from '@/types';

export default function TeamMemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const memberId = (params?.id as string) || 'tm1';
  const { toast } = useToast();

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileData, setProfileData] = useState<Awaited<ReturnType<typeof getMemberFeedbackProfileAction>> | null>(null);
  const [activeTab, setActiveTab] = useState('collated-questions');
  const [isSplitView, setIsSplitView] = useState(false);
  const [isAnonymized, setIsAnonymized] = useState(true);
  const [questionSearch, setQuestionSearch] = useState('');
  const [newActionItemText, setNewActionItemText] = useState('');
  const [newStrengthText, setNewStrengthText] = useState('');
  const [newGrowthText, setNewGrowthText] = useState('');
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({
    q1: true,
    q2: true,
    q3: true,
    q4: true,
    q5: true,
  });

  // Fetch initial member profile and questions collation
  useEffect(() => {
    async function loadData() {
      setIsLoadingProfile(true);
      try {
        const data = await getMemberFeedbackProfileAction(memberId);
        setProfileData(data);
      } catch (err) {
        console.error('Error loading member profile:', err);
        toast({
          variant: 'destructive',
          title: 'Error loading profile',
          description: 'Failed to load member feedback information.',
        });
      } finally {
        setIsLoadingProfile(false);
      }
    }
    loadData();
  }, [memberId, toast]);

  // Connect to live mentor feedback sync
  const {
    feedback: liveFeedback,
    saveFeedback,
    isConnected,
    isSyncing,
    lastSyncedAt,
  } = useLiveMentorFeedback({
    employeeId: memberId,
    initialFeedback: profileData?.mentorFeedback || null,
    role: 'mentor',
  });

  // Handler for updating shared notes with live broadcast
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    saveFeedback({ sharedNotes: e.target.value });
  };

  // Add Action Item
  const handleAddActionItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionItemText.trim() || !liveFeedback) return;

    const newItem: MentorFeedbackActionItem = {
      id: `ai-${Date.now()}`,
      text: newActionItemText.trim(),
      completed: false,
    };

    saveFeedback(
      { actionItems: [...(liveFeedback.actionItems || []), newItem] },
      true
    );
    setNewActionItemText('');
    toast({
      title: 'Action Item Added',
      description: 'Shared live with the team member.',
    });
  };

  // Toggle Action Item
  const handleToggleActionItem = (itemId: string) => {
    if (!liveFeedback) return;
    const updated = (liveFeedback.actionItems || []).map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    saveFeedback({ actionItems: updated }, true);
  };

  // Delete Action Item
  const handleDeleteActionItem = (itemId: string) => {
    if (!liveFeedback) return;
    const updated = (liveFeedback.actionItems || []).filter((item) => item.id !== itemId);
    saveFeedback({ actionItems: updated }, true);
  };

  // Add Strength Tag
  const handleAddStrength = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStrengthText.trim() || !liveFeedback) return;
    if (liveFeedback.strengths.includes(newStrengthText.trim())) return;

    saveFeedback(
      { strengths: [...(liveFeedback.strengths || []), newStrengthText.trim()] },
      true
    );
    setNewStrengthText('');
  };

  // Remove Strength Tag
  const handleRemoveStrength = (str: string) => {
    if (!liveFeedback) return;
    saveFeedback(
      { strengths: (liveFeedback.strengths || []).filter((s) => s !== str) },
      true
    );
  };

  // Add Growth Area Tag
  const handleAddGrowth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGrowthText.trim() || !liveFeedback) return;
    if (liveFeedback.growthAreas.includes(newGrowthText.trim())) return;

    saveFeedback(
      { growthAreas: [...(liveFeedback.growthAreas || []), newGrowthText.trim()] },
      true
    );
    setNewGrowthText('');
  };

  // Remove Growth Area Tag
  const handleRemoveGrowth = (area: string) => {
    if (!liveFeedback) return;
    saveFeedback(
      { growthAreas: (liveFeedback.growthAreas || []).filter((a) => a !== area) },
      true
    );
  };

  // Toggle question expanded state
  const toggleQuestion = (qId: string) => {
    setExpandedQuestions((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    profileData?.collatedQuestions.forEach((q) => {
      allExpanded[q.questionId] = true;
    });
    setExpandedQuestions(allExpanded);
  };

  const collapseAll = () => {
    setExpandedQuestions({});
  };

  // Filter questions
  const filteredQuestions = useMemo(() => {
    if (!profileData?.collatedQuestions) return [];
    if (!questionSearch.trim()) return profileData.collatedQuestions;
    const query = questionSearch.toLowerCase();
    return profileData.collatedQuestions.filter(
      (q) =>
        q.questionText.toLowerCase().includes(query) ||
        (q.category && q.category.toLowerCase().includes(query)) ||
        (q.selfAnswer && q.selfAnswer.toLowerCase().includes(query)) ||
        q.peerAnswers.some((p) => p.answerText.toLowerCase().includes(query) || p.reviewerName.toLowerCase().includes(query))
    );
  }, [profileData?.collatedQuestions, questionSearch]);

  // Unique peer reviewers count
  const allReviewers = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl?: string; role?: string }>();
    profileData?.collatedQuestions.forEach((q) => {
      q.peerAnswers.forEach((p) => {
        if (!map.has(p.reviewerId)) {
          map.set(p.reviewerId, {
            name: p.reviewerName,
            avatarUrl: p.reviewerAvatarUrl,
            role: p.reviewerRole,
          });
        }
      });
    });
    return Array.from(map.values());
  }, [profileData?.collatedQuestions]);

  const totalPeerAnswers = useMemo(() => {
    return profileData?.collatedQuestions.reduce((acc, q) => acc + q.peerAnswers.length, 0) || 0;
  }, [profileData?.collatedQuestions]);

  if (isLoadingProfile || !profileData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-xs text-muted-foreground">Loading team member review profile...</p>
      </div>
    );
  }

  const { employee } = profileData;

  // The Mentor Notes Panel (Used in both normal tab and split-view mode)
  const MentorNotesPanel = () => (
    <Card className="border border-border bg-card shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-semibold border-primary/40 bg-primary/5 text-primary">
                <Sparkles className="mr-1 h-3 w-3" /> Mentor 1:1 Shared Session
              </Badge>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`inline-block h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-muted-foreground font-medium">
                  {isConnected ? 'Live Sync Active' : 'Connecting Sync...'}
                </span>
              </div>
            </div>
            <CardTitle className="text-base font-bold font-headline">
              Feedback & Shared Notes for {employee.name}
            </CardTitle>
            <CardDescription className="text-xs">
              Live shared workspace during in-person or Teams 1:1 feedback review. Updates dynamically on the employee&apos;s dashboard.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-1 font-medium ${
                liveFeedback?.isShared
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800'
              }`}
            >
              <Radio className="mr-1.5 h-3 w-3 text-emerald-500 animate-pulse" />
              {liveFeedback?.isShared ? 'Shared to Employee Screen' : 'Private Draft'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
        {/* Live Shared Notes Editor */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Mentor Feedback & 1:1 Discussion Notes
            </label>
            <span className="text-[11px] text-muted-foreground">
              {isSyncing ? (
                <span className="text-primary font-medium flex items-center gap-1">
                  <span className="animate-spin text-xs">⟳</span> Syncing...
                </span>
              ) : lastSyncedAt ? (
                `Synced at ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              ) : (
                'Live broadcast enabled'
              )}
            </span>
          </div>

          <Textarea
            value={liveFeedback?.sharedNotes || ''}
            onChange={handleNotesChange}
            placeholder={`Summarize the key takeaways, commendations, and strategic expectations discussed with ${employee.name}...`}
            className="min-h-[140px] text-xs leading-relaxed border-border font-sans focus-visible:ring-1"
          />
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Radio className="h-3 w-3 text-emerald-600" />
            As you type, these notes update in real time on {employee.name}&apos;s Dashboard under Feedback History.
          </p>
        </div>

        <Separator />

        {/* Agreed Action Items Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Agreed Action Items & Milestones
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Measurable follow-up commitments agreed upon during this 1:1 review session.
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {(liveFeedback?.actionItems || []).filter((i) => i.completed).length} /{' '}
              {(liveFeedback?.actionItems || []).length} completed
            </span>
          </div>

          {/* Action item input */}
          <form onSubmit={handleAddActionItem} className="flex gap-2">
            <Input
              value={newActionItemText}
              onChange={(e) => setNewActionItemText(e.target.value)}
              placeholder="Add an actionable goal or commitment (e.g. Lead Q4 architecture sync)..."
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" className="h-8 text-xs shrink-0">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
            </Button>
          </form>

          {/* Action items list */}
          <div className="space-y-2 pt-1">
            {(liveFeedback?.actionItems || []).length > 0 ? (
              (liveFeedback?.actionItems || []).map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start justify-between gap-3 p-2.5 rounded-md border text-xs transition-colors ${
                    item.completed
                      ? 'bg-muted/40 border-border/50 text-muted-foreground line-through'
                      : 'bg-card border-border hover:border-border/80'
                  }`}
                >
                  <div
                    onClick={() => handleToggleActionItem(item.id)}
                    className="flex items-start gap-2.5 cursor-pointer flex-1"
                  >
                    <div
                      className={`h-4 w-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                        item.completed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-muted-foreground/50 hover:border-primary'
                      }`}
                    >
                      {item.completed && <Check className="h-3 w-3" />}
                    </div>
                    <span className="leading-snug">{item.text}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteActionItem(item.id)}
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    title="Delete item"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                No action items added yet. Add agreed commitments above to track them in real time.
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Strengths & Growth Areas Tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recognized Strengths */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-emerald-600" /> Key Strengths to Highlight
            </label>
            <form onSubmit={handleAddStrength} className="flex gap-1.5">
              <Input
                value={newStrengthText}
                onChange={(e) => setNewStrengthText(e.target.value)}
                placeholder="Add a strength..."
                className="h-7 text-xs"
              />
              <Button type="submit" size="sm" variant="outline" className="h-7 text-xs px-2">
                <Plus className="h-3 w-3" />
              </Button>
            </form>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(liveFeedback?.strengths || []).map((str) => (
                <Badge
                  key={str}
                  variant="outline"
                  className="text-[11px] py-0.5 pl-2 pr-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1"
                >
                  <span>{str}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStrength(str)}
                    className="text-emerald-700/70 hover:text-emerald-900 rounded-full p-0.5"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Growth & Development Focus */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" /> Focus Areas for Development
            </label>
            <form onSubmit={handleAddGrowth} className="flex gap-1.5">
              <Input
                value={newGrowthText}
                onChange={(e) => setNewGrowthText(e.target.value)}
                placeholder="Add a focus area..."
                className="h-7 text-xs"
              />
              <Button type="submit" size="sm" variant="outline" className="h-7 text-xs px-2">
                <Plus className="h-3 w-3" />
              </Button>
            </form>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(liveFeedback?.growthAreas || []).map((area) => (
                <Badge
                  key={area}
                  variant="outline"
                  className="text-[11px] py-0.5 pl-2 pr-1.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 flex items-center gap-1"
                >
                  <span>{area}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveGrowth(area)}
                    className="text-blue-700/70 hover:text-blue-900 rounded-full p-0.5"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 border-t border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-muted/20">
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span>All edits are automatically saved and broadcast live to {employee.name}.</span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-medium"
            onClick={() => {
              saveFeedback({ isShared: !liveFeedback?.isShared }, true);
              toast({
                title: liveFeedback?.isShared ? 'Sharing Paused' : 'Live Sharing Activated',
                description: liveFeedback?.isShared
                  ? 'Notes are now in private draft.'
                  : `Notes are now live on ${employee.name}'s Dashboard.`,
              });
            }}
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            {liveFeedback?.isShared ? 'Pause Live Sharing' : 'Activate Live Sharing'}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs font-medium shadow-sm"
            onClick={() => {
              saveFeedback({ status: 'finalized' }, true);
              toast({
                title: 'Feedback Session Finalized',
                description: 'Record marked as completed and saved to feedback history.',
              });
            }}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Finalize 1:1 Session
          </Button>
        </div>
      </CardFooter>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Top Back Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground pl-0" asChild>
          <Link href="/team-dashboard">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Team Dashboard
          </Link>
        </Button>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant={isAnonymized ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              setIsAnonymized(!isAnonymized);
              toast({
                title: !isAnonymized ? 'Anonymous Mode Activated' : 'Identified Mode Activated',
                description: !isAnonymized ? 'Peer reviewer identities are now anonymous.' : 'Peer reviewer identities are now visible.',
              });
            }}
            className="h-8 text-xs font-medium gap-1.5"
            title={isAnonymized ? "Reviewer identities are anonymized" : "Showing reviewer identities"}
          >
            <Lock className="h-3 w-3 text-primary" />
            {isAnonymized ? 'Anonymous Mode (On)' : 'Identified Mode'}
          </Button>

          <Button
            variant={isSplitView ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setIsSplitView(!isSplitView)}
            className="h-8 text-xs font-medium"
            title="View questions and mentor feedback side-by-side"
          >
            <Columns className="mr-1.5 h-3.5 w-3.5" />
            {isSplitView ? 'Single View' : 'Side-by-Side Review Mode'}
          </Button>

          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium">
            <Link href="/dashboard" target="_blank">
              <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview Employee Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* Member Profile Hero Banner Card */}
      <Card className="border border-border bg-card shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-primary" />
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            {/* Left: Avatar & Identity */}
            <div className="flex items-start sm:items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20 shadow-sm">
                <AvatarImage src={employee.avatarUrl} alt={employee.name} />
                <AvatarFallback className="text-base font-bold">
                  {employee.name.split(' ').map((n) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-foreground font-headline">
                    {employee.name}
                  </h1>
                  <Badge variant="outline" className="text-xs font-medium border-border">
                    {employee.role === 'employee' ? 'Team Member' : employee.role}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-medium">
                    ID: {employee.id}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">{employee.email}</p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                  <span>
                    Direct Mentor / Lead:{' '}
                    <strong className="text-foreground font-medium">{employee.mentorName}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Cycle: <strong className="text-foreground font-medium">FY2024 H2 Performance Review</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick Stats KPIs */}
            <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Self-Review
                </span>
                <Badge variant="outline" className="mt-1 text-[11px] border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">
                  Submitted
                </Badge>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Peer Reviews
                </span>
                <span className="text-base font-bold text-foreground mt-0.5 block">
                  {allReviewers.length} Reviewers
                </span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Questions Collated
                </span>
                <span className="text-base font-bold text-foreground mt-0.5 block">
                  {profileData.collatedQuestions.length} Questions
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area: Split View or Standard Tabs */}
      {isSplitView ? (
        /* Side-by-Side Review Mode */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* Left Column: Collated Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold font-headline text-foreground">
                  Feedback Collated By Question ({profileData.collatedQuestions.length})
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-[11px]">
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-[11px]">
                  Collapse All
                </Button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4 max-h-[800px] overflow-y-auto pr-1">
              {filteredQuestions.map((q) => (
                <QuestionCollationCard
                  key={q.questionId}
                  question={q}
                  isExpanded={!!expandedQuestions[q.questionId]}
                  onToggle={() => toggleQuestion(q.questionId)}
                  employeeName={employee.name}
                  isAnonymized={isAnonymized}
                />
              ))}
            </div>
          </div>

          {/* Right Column: Live Mentor Notes */}
          <div className="sticky top-4">
            <MentorNotesPanel />
          </div>
        </div>
      ) : (
        /* Standard Tabs Mode */
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted p-1 rounded-lg border border-border/50 flex flex-wrap sm:inline-flex w-full sm:w-auto h-auto gap-1">
            <TabsTrigger
              value="collated-questions"
              className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Collated Feedback by Question ({profileData.collatedQuestions.length})
            </TabsTrigger>
            <TabsTrigger
              value="mentor-notes"
              className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm relative"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Mentor Feedback & 1:1 Live Notes
              {liveFeedback?.isShared && (
                <span className="ml-1.5 h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="individual-reviews"
              className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Individual Peer Reviews ({allReviewers.length})
            </TabsTrigger>
            <TabsTrigger
              value="ai-insights"
              className="text-xs px-3 py-1.5 font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Overview & AI Insights
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Collated Feedback Grouped by Question */}
          <TabsContent value="collated-questions" className="space-y-4 mt-4">
            {/* Header info & Filter toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3 rounded-lg border border-border">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground">
                    Combined Feedback Grouped by Question
                  </p>
                  {isAnonymized && (
                    <Badge variant="outline" className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> Anonymous Mode
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Side-by-side synthesis comparing {employee.name}&apos;s self-assessment with all peer review responses for each question.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter questions or responses..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={expandAll} className="h-8 text-xs">
                  Expand All
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll} className="h-8 text-xs">
                  Collapse All
                </Button>
              </div>
            </div>

            {/* Questions Collation List */}
            <div className="space-y-4">
              {filteredQuestions.length > 0 ? (
                filteredQuestions.map((q) => (
                  <QuestionCollationCard
                    key={q.questionId}
                    question={q}
                    isExpanded={!!expandedQuestions[q.questionId]}
                    onToggle={() => toggleQuestion(q.questionId)}
                    employeeName={employee.name}
                    isAnonymized={isAnonymized}
                  />
                ))
              ) : (
                <Card className="text-center py-12 border-dashed">
                  <CardContent>
                    <Search className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <h3 className="text-sm font-semibold text-foreground">No matching questions</h3>
                    <p className="text-xs text-muted-foreground mt-1">Try adjusting your filter query.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: Mentor Feedback & Live Notes */}
          <TabsContent value="mentor-notes" className="mt-4">
            <MentorNotesPanel />
          </TabsContent>

          {/* TAB 3: Individual Peer Reviews */}
          <TabsContent value="individual-reviews" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allReviewers.map((rev, revIdx) => {
                const displayName = isAnonymized ? `Peer Reviewer #${revIdx + 1}` : rev.name;
                const displayRole = isAnonymized ? 'Anonymous Peer Reviewer' : (rev.role || 'Peer Reviewer');

                // Find all responses submitted by this reviewer
                const reviewerAnswers = profileData.collatedQuestions
                  .map((q) => {
                    const ans = q.peerAnswers.find((p) => p.reviewerName === rev.name);
                    return ans ? { question: q.questionText, answer: ans.answerText } : null;
                  })
                  .filter(Boolean) as Array<{ question: string; answer: string }>;

                return (
                  <Card key={rev.name} className="border border-border bg-card shadow-sm flex flex-col justify-between">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 ring-1 ring-border">
                          {!isAnonymized && <AvatarImage src={rev.avatarUrl} alt={rev.name} />}
                          <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                            {isAnonymized ? <Lock className="h-3.5 w-3.5" /> : rev.name.split(' ').map((n) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-sm font-semibold font-headline flex items-center gap-1.5">
                            {displayName}
                            {isAnonymized && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
                                Anonymous
                              </Badge>
                            )}
                          </CardTitle>
                          <p className="text-[11px] text-muted-foreground">{displayRole}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Responses Provided</span>
                        <Badge variant="secondary" className="text-[11px]">
                          {reviewerAnswers.length} Answers
                        </Badge>
                      </div>
                      <div className="space-y-2 pt-1">
                        {reviewerAnswers.slice(0, 2).map((ans, i) => (
                          <div key={i} className="text-xs p-2 rounded bg-muted/40 border border-border/40">
                            <p className="font-medium text-foreground text-[11px] line-clamp-1">{ans.question}</p>
                            <p className="text-muted-foreground mt-1 line-clamp-2 italic text-[11px]">
                              &ldquo;{ans.answer}&rdquo;
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 border-t border-border/40">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs h-7 text-primary hover:text-primary"
                        onClick={() => {
                          setQuestionSearch(rev.name);
                          setActiveTab('collated-questions');
                        }}
                      >
                        View in Collated Questions →
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 4: AI Insights */}
          <TabsContent value="ai-insights" className="space-y-4 mt-4">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-base font-semibold font-headline flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary" /> Aggregated AI Feedback Insights
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Machine-learning synthesis of common themes, sentiment analysis, and key opportunities.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
                    <ThumbsUp className="mr-1 h-3 w-3" /> Positive Consensus
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="p-4 rounded-lg bg-muted/40 border border-border/50 leading-relaxed text-xs text-foreground/90">
                  <p className="font-semibold text-foreground text-sm mb-1.5">Executive Summary</p>
                  <p>
                    {employee.name} has demonstrated outstanding technical execution and leadership throughout the review cycle.
                    All peer reviewers highlighted exceptional code reliability, rapid code review turnaround times, and
                    willingness to pair program during complex production triage. The primary growth opportunity identified across both
                    self-evaluation and peer feedback is increasing delegation of sub-tasks to mentor junior engineers and expanding
                    executive-level communication.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2 p-4 rounded-lg border border-border/60 bg-card">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5 text-emerald-600" /> Core Strengths Identified
                    </span>
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4 pt-1">
                      <li>Auth middleware refactoring and high-availability systems design</li>
                      <li>Prompt, constructive PR reviews and proactive incident debugging</li>
                      <li>Collaborative, patient mentorship during engineering pairing sessions</li>
                    </ul>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border border-border/60 bg-card">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-600" /> Recommended Growth Areas
                    </span>
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4 pt-1">
                      <li>Scoping multi-quarter initiatives with non-technical business stakeholders</li>
                      <li>Delegating architectural sub-tasks to foster junior team ownership</li>
                      <li>Presenting system designs at engineering all-hands and cross-team forums</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/**
 * Component representing a single Question in the Collation view,
 * containing both the Self-Review answer and all Peer Review answers side-by-side.
 */
function QuestionCollationCard({
  question,
  isExpanded,
  onToggle,
  employeeName,
  isAnonymized = true,
}: {
  question: QuestionFeedbackCollation;
  isExpanded: boolean;
  onToggle: () => void;
  employeeName: string;
  isAnonymized?: boolean;
}) {
  return (
    <Card className="border border-border bg-card shadow-sm hover:border-border/80 transition-all overflow-hidden">
      {/* Question Card Header (Clickable to expand/collapse) */}
      <CardHeader
        onClick={onToggle}
        className="p-4 cursor-pointer select-none bg-muted/20 hover:bg-muted/30 transition-colors border-b border-border/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
              Q{question.order}
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {question.category && (
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider border-border">
                    {question.category}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {question.peerAnswers.length} Peer Response{question.peerAnswers.length !== 1 ? 's' : ''}
                </span>
                {isAnonymized && (
                  <Badge variant="outline" className="text-[10px] border-border text-muted-foreground flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" /> Anonymous
                  </Badge>
                )}
                {question.selfAnswer && (
                  <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">
                    Self Assessment Included
                  </Badge>
                )}
              </div>
              <h3 className="text-sm font-semibold font-headline text-foreground leading-snug">
                {question.questionText}
              </h3>
            </div>
          </div>

          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {/* Question Collated Content */}
      {isExpanded && (
        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* Section 1: Employee Self-Assessment Answer */}
          <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/20 dark:bg-emerald-950/10 dark:border-emerald-900/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] font-bold">
                  ★
                </span>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                  Self-Evaluation: {employeeName}
                </span>
              </div>
              {question.selfAnswerSubmittedAt && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(question.selfAnswerSubmittedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>

            <p className="text-xs text-foreground/90 leading-relaxed pl-7">
              {question.selfAnswer ? (
                question.selfAnswer
              ) : (
                <span className="italic text-muted-foreground">No self-assessment recorded for this question.</span>
              )}
            </p>
          </div>

          {/* Section 2: Grouped Peer Feedback Answers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                Collated Peer Feedback ({question.peerAnswers.length})
              </h4>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                {isAnonymized && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
                {isAnonymized ? 'Reviewer identities hidden' : 'Grouped across all reviewers'}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
              {question.peerAnswers.map((peer, idx) => {
                const peerDisplayName = isAnonymized ? `Anonymous Peer #${idx + 1}` : peer.reviewerName;
                const peerDisplayRole = isAnonymized ? 'Verified Peer Reviewer' : peer.reviewerRole;

                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/70 bg-card p-3.5 space-y-2.5 flex flex-col justify-between hover:border-border transition-colors shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 ring-1 ring-border">
                          {!isAnonymized && <AvatarImage src={peer.reviewerAvatarUrl} alt={peer.reviewerName} />}
                          <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
                            {isAnonymized ? <Lock className="h-2.5 w-2.5" /> : peer.reviewerName.split(' ').map((n) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1 leading-tight">
                            {peerDisplayName}
                            {isAnonymized && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
                                Anonymous
                              </Badge>
                            )}
                          </span>
                          {peerDisplayRole && (
                            <span className="text-[10px] text-muted-foreground block">{peerDisplayRole}</span>
                          )}
                        </div>
                      </div>

                      {peer.sentiment && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-normal py-0 px-1.5 ${
                            peer.sentiment === 'positive'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : peer.sentiment === 'constructive'
                            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'border-slate-200 bg-slate-100 text-slate-700 dark:bg-slate-800'
                        }`}
                      >
                        {peer.sentiment === 'positive' ? 'Positive' : peer.sentiment === 'constructive' ? 'Growth' : 'Neutral'}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-foreground/90 leading-relaxed italic bg-muted/20 p-2.5 rounded border border-border/40">
                    &ldquo;{peer.answerText}&rdquo;
                  </p>

                  {peer.submittedAt && (
                    <div className="flex justify-end">
                      <span className="text-[10px] text-muted-foreground">
                        Recorded on {new Date(peer.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
