"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, MessageSquare, ThumbsUp, ThumbsDown, AlertTriangle, Eye, Users, Search, CheckCircle2, Clock, ShieldAlert, Loader2 } from 'lucide-react';
import type { TeamMemberFeedback, User } from '@/types';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeamDashboardDataAction, type TeamDashboardData } from './actions';
import { useToast } from '@/hooks/use-toast';

const SentimentDisplay = ({ sentiment }: { sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed' }) => {
  if (!sentiment) return <span className="text-xs text-muted-foreground">Pending Data</span>;
  
  const sentimentConfig = {
    positive: { icon: <ThumbsUp className="h-3 w-3 text-emerald-600" />, label: 'Positive', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' },
    neutral: { icon: <MessageSquare className="h-3 w-3 text-slate-600" />, label: 'Neutral', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
    negative: { icon: <ThumbsDown className="h-3 w-3 text-rose-600" />, label: 'Negative', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800' },
    mixed: { icon: <BarChart3 className="h-3 w-3 text-blue-600" />, label: 'Mixed', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800' },
  };
  const config = sentimentConfig[sentiment];
  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1 text-[11px] font-medium py-0 px-2 ${config.badgeClass}`}>
      {config.icon}
      <span>{config.label}</span>
    </Badge>
  );
};

const getSelfReviewBadge = (status: TeamMemberFeedback['selfReviewStatus']) => {
  switch(status) {
    case 'submitted':
      return <Badge variant="outline" className="text-[11px] border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium">Submitted</Badge>;
    case 'draft':
      return <Badge variant="outline" className="text-[11px] border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-medium">In Draft</Badge>;
    case 'not_started':
      return <Badge variant="outline" className="text-[11px] border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 font-medium">Not Started</Badge>;
    default:
      return null;
  }
};

const TeamMemberCard = ({ member }: { member: TeamMemberFeedback }) => {
  const peerReviewProgress = member.peerReviewsAssignedCount > 0 ? (member.peerReviewsCompletedCount / member.peerReviewsAssignedCount) * 100 : 0;
  const isAtRisk = member.selfReviewStatus === 'not_started' || (member.peerReviewsAssignedCount > 0 && peerReviewProgress < 50);

  return (
    <Card className="border border-border bg-card shadow-sm hover:border-border/80 hover:shadow transition-all flex flex-col justify-between">
      <CardHeader className="flex flex-row items-start justify-between space-x-3 pb-3">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 ring-1 ring-border">
            <AvatarImage src={member.avatarUrl} alt={member.name} data-ai-hint="employee avatar" />
            <AvatarFallback className="text-xs font-semibold">{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold font-headline">{member.name}</CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Self-Review:</span>
              {getSelfReviewBadge(member.selfReviewStatus)}
            </div>
          </div>
        </div>
        {isAtRisk && member.selfReviewStatus !== 'submitted' && (
          <span title="Action required" className="text-rose-500 bg-rose-50 dark:bg-rose-950/40 p-1 rounded">
            <AlertTriangle className="h-4 w-4" />
          </span>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3 pt-0 pb-3 flex-1">
        <div className="space-y-1.5 rounded-md bg-muted/40 p-2.5 border border-border/50">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground font-medium">Peer Feedback Progress</span>
            <span className="font-semibold text-foreground">{member.peerReviewsCompletedCount} / {member.peerReviewsAssignedCount}</span>
          </div>
          <Progress value={peerReviewProgress} aria-label={`${peerReviewProgress}% peer reviews completed`} className="h-1.5" />
        </div>

        {member.feedbackSummary && (
          <div className="space-y-1 border-t border-border/50 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">AI Feedback Insights</span>
              <SentimentDisplay sentiment={member.sentiment} />
            </div>
            <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed">{member.feedbackSummary}</p>
          </div>
        )}

        {member.keyImprovementAreas && member.keyImprovementAreas.length > 0 && (
          <div className="space-y-1 border-t border-border/50 pt-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Focus Areas</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {member.keyImprovementAreas.slice(0, 2).map(area => (
                <span key={area} className="inline-block rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 border-t border-border/50">
        <Button variant="outline" size="sm" className="w-full text-xs font-medium h-8" asChild>
          <Link href={`/team-dashboard/member/${member.id}`}>
            <Eye className="mr-1.5 h-3.5 w-3.5" /> View Full Profile
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function TeamDashboardPage() {
  const [data, setData] = useState<TeamDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const { toast } = useToast();

  const fetchTeamData = async () => {
    try {
      setIsLoading(true);
      const res = await getTeamDashboardDataAction();
      setData(res);
    } catch (error) {
      console.error('Failed to load team dashboard data:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading team data',
        description: 'Could not fetch the latest review status for your team.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  const members = data?.members || [];
  const totalMembers = data?.totalMembers || 0;
  const submittedCount = data?.submittedCount || 0;
  const atRiskCount = data?.atRiskCount || 0;
  const totalAssignedPeer = data?.totalAssignedPeer || 0;
  const totalCompletedPeer = data?.totalCompletedPeer || 0;

  const filteredMembers = members.filter(member => {
    const searchLower = (searchTerm || '').toLowerCase();
    const nameMatch = (member?.name || '').toLowerCase().includes(searchLower);
    const statusMatch = filterStatus === 'all' || 
                        (filterStatus === 'at_risk' && (member.selfReviewStatus === 'not_started' || (member.peerReviewsAssignedCount > 0 && (member.peerReviewsCompletedCount / member.peerReviewsAssignedCount) < 0.5))) ||
                        (filterStatus === 'submitted' && member.selfReviewStatus === 'submitted') ||
                        (filterStatus === 'pending' && (member.selfReviewStatus === 'draft' || member.selfReviewStatus === 'not_started'));
    return nameMatch && statusMatch;
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Team Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            {data?.isDirectReportsOnly ? 'Monitor performance review participation and sentiment across your direct reports' : 'Monitor performance review participation and sentiment across your organization'}
          </p>
        </div>
        {data?.userRole === 'admin' && (
          <Button size="sm" className="h-9 font-medium shadow-sm" asChild>
            <Link href="/admin/assignments">
              <Users className="mr-1.5 h-4 w-4" /> Manage Team Reviews
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-xs text-muted-foreground">Loading team review metrics...</p>
        </div>
      ) : (
        <>
          {/* KPI Metrics */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {data?.isDirectReportsOnly ? 'Direct Reports' : 'Team Members'}
                </span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{totalMembers}</span>
                <span className="text-xs text-muted-foreground">members</span>
              </div>
            </Card>

            <Card className="p-4 border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Self-Reviews Completed</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{submittedCount}/{totalMembers}</span>
                <span className="text-xs text-muted-foreground">
                  ({totalMembers > 0 ? Math.round((submittedCount / totalMembers) * 100) : 0}%)
                </span>
              </div>
            </Card>

            <Card className="p-4 border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Peer Reviews Filled</span>
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{totalCompletedPeer}/{totalAssignedPeer}</span>
                <span className="text-xs text-muted-foreground">
                  ({totalAssignedPeer > 0 ? Math.round((totalCompletedPeer / totalAssignedPeer) * 100) : 0}%)
                </span>
              </div>
            </Card>

            <Card className="p-4 border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Attention Needed</span>
                <ShieldAlert className="h-4 w-4 text-rose-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${atRiskCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                  {atRiskCount}
                </span>
                <span className="text-xs text-muted-foreground">at-risk</span>
              </div>
            </Card>
          </div>

          {/* Main Team Member List Card */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <CardTitle className="text-base font-semibold font-headline">Team Members Progress</CardTitle>
                  <CardDescription className="text-xs">Detailed view of review status and automated feedback insights</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Search team member..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-9 text-xs w-full sm:w-[200px]"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Members ({members.length})</SelectItem>
                      <SelectItem value="at_risk" className="text-xs">At Risk ({atRiskCount})</SelectItem>
                      <SelectItem value="submitted" className="text-xs">Submitted Self-Review ({submittedCount})</SelectItem>
                      <SelectItem value="pending" className="text-xs">Pending Self-Review ({totalMembers - submittedCount})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {filteredMembers.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredMembers.map((member) => (
                    <TeamMemberCard key={member.id} member={member} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {members.length === 0 ? "No team members found" : "No team members match your filter"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {members.length === 0 
                      ? (data?.isDirectReportsOnly 
                          ? "No direct reports are assigned to you yet in Manage Staff." 
                          : "No staff members found in the directory.")
                      : "Try changing the search query or status filter."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
