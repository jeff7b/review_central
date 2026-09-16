"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, MessageSquare, ThumbsUp, ThumbsDown, AlertTriangle, Eye, Users, ArrowRight, Search, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import type { TeamMemberFeedback } from '@/types';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mock Data
const mockTeamMembers: TeamMemberFeedback[] = [
  {
    id: 'tm1', name: 'Alice Wonderland', avatarUrl: 'https://placehold.co/100x100.png?text=AW',
    selfReviewStatus: 'submitted', peerReviewsAssignedCount: 5, peerReviewsCompletedCount: 4,
    feedbackSummary: 'Alice consistently delivers high-quality work and is a great team player. Could focus more on strategic thinking.',
    sentiment: 'positive', keyImprovementAreas: ['Strategic Thinking', 'Public Speaking']
  },
  {
    id: 'tm2', name: 'Bob The Builder', avatarUrl: 'https://placehold.co/100x100.png?text=BB',
    selfReviewStatus: 'draft', peerReviewsAssignedCount: 4, peerReviewsCompletedCount: 1,
    feedbackSummary: 'Bob shows strong technical skills but needs to improve communication with non-technical team members.',
    sentiment: 'mixed', keyImprovementAreas: ['Communication', 'Time Management']
  },
  {
    id: 'tm3', name: 'Charlie Brown', avatarUrl: 'https://placehold.co/100x100.png?text=CB',
    selfReviewStatus: 'not_started', peerReviewsAssignedCount: 3, peerReviewsCompletedCount: 0,
    sentiment: undefined, // No AI data yet
  },
  {
    id: 'tm4', name: 'Diana Prince', avatarUrl: 'https://placehold.co/100x100.png?text=DP',
    selfReviewStatus: 'submitted', peerReviewsAssignedCount: 5, peerReviewsCompletedCount: 5,
    feedbackSummary: 'Diana is an exceptional leader and consistently exceeds expectations. No major areas for improvement noted.',
    sentiment: 'positive', keyImprovementAreas: []
  },
];

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
  const isAtRisk = member.selfReviewStatus === 'not_started' || peerReviewProgress < 50;

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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const totalMembers = mockTeamMembers.length;
  const submittedCount = mockTeamMembers.filter(m => m.selfReviewStatus === 'submitted').length;
  const atRiskCount = mockTeamMembers.filter(m => m.selfReviewStatus === 'not_started' || (m.peerReviewsAssignedCount > 0 && (m.peerReviewsCompletedCount / m.peerReviewsAssignedCount) < 0.5)).length;
  const totalAssignedPeer = mockTeamMembers.reduce((acc, m) => acc + m.peerReviewsAssignedCount, 0);
  const totalCompletedPeer = mockTeamMembers.reduce((acc, m) => acc + m.peerReviewsCompletedCount, 0);

  const filteredMembers = mockTeamMembers.filter(member => {
    const nameMatch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
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
          <p className="text-xs text-muted-foreground">Monitor performance review participation and sentiment across your team</p>
        </div>
        <Button size="sm" className="h-9 font-medium shadow-sm">
          <Users className="mr-1.5 h-4 w-4" /> Manage Team Reviews
        </Button>
      </div>

      {/* KPI Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Direct Reports</span>
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
            <span className="text-xs text-muted-foreground">({Math.round((submittedCount/totalMembers)*100)}%)</span>
          </div>
        </Card>

        <Card className="p-4 border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Peer Reviews Filled</span>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalCompletedPeer}/{totalAssignedPeer}</span>
            <span className="text-xs text-muted-foreground">({Math.round((totalCompletedPeer/totalAssignedPeer)*100)}%)</span>
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
                  <SelectItem value="all" className="text-xs">All Members ({mockTeamMembers.length})</SelectItem>
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
              <h3 className="text-sm font-semibold text-foreground">No team members match your filter</h3>
              <p className="text-xs text-muted-foreground mt-1">Try changing the search query or status filter.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
