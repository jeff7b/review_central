"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  PlusCircle,
  Edit,
  Trash2,
  UserCheck,
  CalendarIcon,
  ChevronsUpDown,
  Loader2,
  Check,
  RotateCcw,
  Users,
  BarChart3,
  ListFilter,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import type { User, PeerReviewAssignment, Questionnaire, ReviewCycle } from '@/types';
import { format, parseISO } from 'date-fns';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import { getActiveQuestionnairesAction } from '../questionnaires/actions';
import { getActiveReviewCyclesAction } from '../review-cycles/actions';
import { saveAssignmentAction, getAssignmentsByCycleAction, deleteAssignmentAction, clearSubmittedReviewAction, clearAllSubmittedReviewsAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { getUsersAction } from '../staff/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

function getInitials(name: string): string {
  if (!name) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const UserCombobox = ({
  users,
  selectedUser,
  onSelectUser,
  placeholder,
  disabled = false,
}: {
  users: User[];
  selectedUser?: User;
  onSelectUser: (user?: User) => void;
  placeholder: string;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          {selectedUser ? (
            <div className="flex items-center">
              <Avatar className="h-5 w-5 mr-2">
                <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.name} data-ai-hint="user avatar small" />
                <AvatarFallback>{getInitials(selectedUser.name)}</AvatarFallback>
              </Avatar>
              {selectedUser.name}
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search user..." />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.name}
                  onSelect={() => {
                    onSelectUser(user);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedUser?.id === user.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex items-center">
                     <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user avatar small" />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    {user.name}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const AssignmentForm = ({
  assignment,
  initialRevieweeId,
  cycle,
  users,
  questionnaires,
  onSave,
  onCancel,
  isSaving,
}: {
  assignment?: PeerReviewAssignment;
  initialRevieweeId?: string;
  cycle: ReviewCycle;
  users: User[];
  questionnaires: Questionnaire[];
  onSave: (data: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}) => {
  const getInitialUser = (id?: string) => users.find(u => u.id === id);
  
  const [reviewee, setReviewee] = useState<User | undefined>(getInitialUser(assignment?.revieweeId || initialRevieweeId));
  const [reviewer, setReviewer] = useState<User | undefined>(getInitialUser(assignment?.reviewerId));
  const [questionnaireId, setQuestionnaireId] = useState<string | undefined>(assignment?.questionnaireId || questionnaires[0]?.id);
  const [status, setStatus] = useState<PeerReviewAssignment['status']>(assignment?.status || 'pending');
  const [dueDate, setDueDate] = useState<Date | undefined>(assignment ? parseISO(assignment.dueDate) : new Date(cycle.endDate));
  const { toast } = useToast();
  
  const cycleParticipants = useMemo(() => {
    const participantMap = new Map(users.map(u => [u.id, u]));
    return cycle.participantIds.map(id => participantMap.get(id)).filter(Boolean) as User[];
  }, [cycle, users]);

  const handleSubmit = () => {
    if (!reviewee || !reviewer || !questionnaireId || !dueDate) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please fill out all fields to create an assignment." });
      return;
    }
    if (reviewee.id === reviewer.id) {
        toast({ variant: "destructive", title: "Invalid Assignment", description: "A user cannot be assigned to review themselves." });
        return;
    }
    onSave({
      id: assignment?.id,
      reviewCycleId: cycle.id,
      reviewee,
      reviewer,
      questionnaireId,
      status,
      dueDate: dueDate.toISOString(),
    });
  };
  
  const availableReviewers = useMemo(() => cycleParticipants.filter(u => u.id !== reviewee?.id), [cycleParticipants, reviewee]);

  useEffect(() => {
    if (reviewee && reviewer && reviewee.id === reviewer.id) setReviewer(undefined);
  }, [reviewee, reviewer]);

  return (
     <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
            <CardTitle>{assignment ? 'Edit' : 'Create New'} Assignment</CardTitle>
            <CardDescription>For review cycle: <span className="font-semibold">{cycle.name}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Label>Reviewee (Person to be reviewed)</Label>
                <UserCombobox users={cycleParticipants} selectedUser={reviewee} onSelectUser={setReviewee} placeholder="Select reviewee..." />
            </div>
            <div>
                <Label>Reviewer (Person to give feedback)</Label>
                <UserCombobox users={availableReviewers} selectedUser={reviewer} onSelectUser={setReviewer} placeholder="Select reviewer..." disabled={!reviewee} />
            </div>
             <div>
                <Label htmlFor="questionnaire">Questionnaire</Label>
                <Select value={questionnaireId} onValueChange={setQuestionnaireId}>
                    <SelectTrigger id="questionnaire"><SelectValue placeholder="Select questionnaire..." /></SelectTrigger>
                    <SelectContent>{questionnaires.map(q => (<SelectItem key={q.id} value={q.id}>{q.name} (v{q.version})</SelectItem>))}</SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button id="dueDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus /></PopoverContent>
                </Popover>
            </div>
            {assignment && (
                <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={status} onValueChange={(val) => setStatus(val as PeerReviewAssignment['status'])}>
                        <SelectTrigger id="status"><SelectValue placeholder="Select status..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                    </Select>
                    {assignment.status === 'completed' && status === 'pending' && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Setting status to Pending will clear the submitted review so it can be redone.
                        </p>
                    )}
                </div>
            )}
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Assignment
            </Button>
        </CardFooter>
     </Card>
  );
};

const ReviewerInitialBadge = ({
  assignment,
  allQuestionnaires,
  onEdit,
  onDelete,
  onClearReview,
}: {
  assignment: PeerReviewAssignment;
  allQuestionnaires: Questionnaire[];
  onEdit: (a: PeerReviewAssignment) => void;
  onDelete: (id: string) => void;
  onClearReview: (id: string) => void;
}) => {
  const initials = getInitials(assignment.reviewerName);

  const statusStyles: Record<PeerReviewAssignment['status'], { badge: string; dot: string; label: string }> = {
    completed: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700',
      dot: 'bg-emerald-500',
      label: 'Completed',
    },
    in_progress: {
      badge: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700',
      dot: 'bg-blue-500',
      label: 'In Progress',
    },
    pending: {
      badge: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700',
      dot: 'bg-amber-500',
      label: 'Pending',
    },
    declined: {
      badge: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700',
      dot: 'bg-rose-500',
      label: 'Declined',
    },
  };

  const currentStatus = statusStyles[assignment.status] || statusStyles.pending;
  const questionnaireName = allQuestionnaires.find(q => q.id === assignment.questionnaireId)?.name || 'Peer Review';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "group relative inline-flex items-center justify-center h-8 w-8 rounded-full border text-[11px] font-bold tracking-tight transition-all hover:scale-110 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 cursor-pointer",
                currentStatus.badge
              )}
              aria-label={`Reviewer: ${assignment.reviewerName} (${currentStatus.label})`}
            >
              {initials}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border border-background shadow-2xs",
                  currentStatus.dot
                )}
              />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs space-y-0.5 py-1.5 px-2.5">
          <div className="font-semibold text-foreground">{assignment.reviewerName}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", currentStatus.dot)} />
            <span>{currentStatus.label}</span>
          </div>
          <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{questionnaireName}</div>
          <div className="text-[10px] text-muted-foreground pt-0.5">Click to manage</div>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="center" className="w-56 text-xs">
        <DropdownMenuLabel className="font-normal pb-1">
          <div className="font-semibold text-foreground">{assignment.reviewerName}</div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>Status:</span>
            <span className="font-medium text-foreground capitalize">{currentStatus.label}</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{questionnaireName}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {assignment.status === 'completed' && (
          <DropdownMenuItem
            onClick={() => onClearReview(assignment.id)}
            className="text-amber-700 dark:text-amber-400 focus:text-amber-800 cursor-pointer"
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Clear review so it can be redone
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onEdit(assignment)} className="cursor-pointer">
          <Edit className="mr-2 h-3.5 w-3.5" />
          Edit assignment
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(assignment.id)}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete assignment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AdminShortcutButton = ({
  reviewee,
  adminUsers,
  assignmentsForReviewee,
  isSaving,
  onAssignAdmin,
}: {
  reviewee: User;
  adminUsers: User[];
  assignmentsForReviewee: PeerReviewAssignment[];
  isSaving: boolean;
  onAssignAdmin: (reviewee: User, adminUser: User) => void;
}) => {
  const assignedAdminAssignment = assignmentsForReviewee.find(a =>
    adminUsers.some(adm => adm.id === a.reviewerId)
  );

  if (assignedAdminAssignment) {
    const adminUser = adminUsers.find(adm => adm.id === assignedAdminAssignment.reviewerId);
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-normal gap-1 h-7 px-2.5"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>{adminUser ? `${adminUser.name.split(' ')[0]} (Admin)` : 'Admin Assigned'}</span>
      </Badge>
    );
  }

  // If reviewee is the only admin
  if (reviewee.role === 'admin' && adminUsers.length === 1 && adminUsers[0].id === reviewee.id) {
    return (
      <span className="text-xs text-muted-foreground italic px-2">Is Admin</span>
    );
  }

  const availableAdmins = adminUsers.filter(adm => adm.id !== reviewee.id);

  if (availableAdmins.length === 0) {
    return (
      <span className="text-xs text-muted-foreground italic px-2">No admin available</span>
    );
  }

  if (availableAdmins.length === 1) {
    const singleAdmin = availableAdmins[0];
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAssignAdmin(reviewee, singleAdmin)}
        disabled={isSaving}
        className="h-7 text-xs gap-1 border-primary/30 hover:border-primary hover:bg-primary/5 text-primary"
        title={`Assign ${singleAdmin.name} as reviewer`}
      >
        <Shield className="h-3.5 w-3.5" />
        Set Admin ({singleAdmin.name.split(' ')[0]})
      </Button>
    );
  }

  // Multiple admins available: show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isSaving}
          className="h-7 text-xs gap-1 border-primary/30 hover:border-primary hover:bg-primary/5 text-primary"
        >
          <Shield className="h-3.5 w-3.5" />
          Set Admin
          <ChevronsUpDown className="h-3 w-3 opacity-50 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs w-48">
        <DropdownMenuLabel className="text-xs">Select Admin Reviewer</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableAdmins.map(adm => (
          <DropdownMenuItem
            key={adm.id}
            onClick={() => onAssignAdmin(reviewee, adm)}
            className="cursor-pointer"
          >
            <Avatar className="h-4 w-4 mr-2">
              <AvatarImage src={adm.avatarUrl} alt={adm.name} />
              <AvatarFallback className="text-[9px]">{getInitials(adm.name)}</AvatarFallback>
            </Avatar>
            {adm.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AddReviewerDropdown = ({
  reviewee,
  users,
  cycle,
  assignmentsForReviewee,
  isSaving,
  onAssignReviewer,
}: {
  reviewee: User;
  users: User[];
  cycle: ReviewCycle;
  assignmentsForReviewee: PeerReviewAssignment[];
  isSaving: boolean;
  onAssignReviewer: (reviewee: User, reviewer: User) => void;
}) => {
  const [open, setOpen] = useState(false);

  const assignedReviewerIds = useMemo(
    () => new Set(assignmentsForReviewee.map(a => a.reviewerId)),
    [assignmentsForReviewee]
  );

  const possibleReviewers = useMemo(() => {
    const participantSet = new Set(cycle.participantIds);
    return users
      .filter(u => u.id !== reviewee.id && !assignedReviewerIds.has(u.id))
      .sort((a, b) => {
        const aInCycle = participantSet.has(a.id);
        const bInCycle = participantSet.has(b.id);
        if (aInCycle && !bInCycle) return -1;
        if (!aInCycle && bInCycle) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [users, reviewee.id, assignedReviewerIds, cycle.participantIds]);

  if (possibleReviewers.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="h-8 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed"
      >
        <PlusCircle className="h-3.5 w-3.5 mr-1" />
        No more reviewers
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isSaving}
          className="h-8 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground"
        >
          <PlusCircle className="h-3.5 w-3.5 text-primary" />
          Add Reviewer
          <ChevronsUpDown className="h-3 w-3 opacity-50 ml-0.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search reviewer..." />
          <CommandList>
            <CommandEmpty>No reviewer found.</CommandEmpty>
            <CommandGroup heading="Available Reviewers">
              {possibleReviewers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.name}
                  onSelect={() => {
                    onAssignReviewer(reviewee, user);
                    setOpen(false);
                  }}
                  className="cursor-pointer py-1.5"
                >
                  <Avatar className="h-5 w-5 mr-2 ring-1 ring-border">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="text-[9px] font-medium">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col truncate flex-1 min-w-0">
                    <span className="font-medium text-foreground text-xs truncate">{user.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {user.role === 'admin' ? 'Admin' : user.role === 'team_leader' ? 'Team Leader' : user.email || 'Employee'}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<PeerReviewAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map());
  const [allQuestionnaires, setAllQuestionnaires] = useState<Questionnaire[]>([]);
  const [reviewCycles, setReviewCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<PeerReviewAssignment | undefined>(undefined);
  const [preselectedRevieweeId, setPreselectedRevieweeId] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  const selectedCycle = useMemo(() => reviewCycles.find(c => c.id === selectedCycleId), [reviewCycles, selectedCycleId]);
  
  const completedAssignmentsCount = useMemo(() => {
    return assignments.filter(a => a.status === 'completed').length;
  }, [assignments]);

  const adminUsers = useMemo(() => {
    return users.filter(u => u.role === 'admin');
  }, [users]);

  const revieweesList = useMemo(() => {
    if (!selectedCycle) return [];
    const cycleParticipantUsers = selectedCycle.participantIds
      .map(id => usersMap.get(id))
      .filter(Boolean) as User[];

    const assignedReviewees: User[] = [];
    for (const a of assignments) {
      if (!selectedCycle.participantIds.includes(a.revieweeId) && !assignedReviewees.some(u => u.id === a.revieweeId)) {
        const u = usersMap.get(a.revieweeId) || {
          id: a.revieweeId,
          name: a.revieweeName,
          email: '',
          avatarUrl: a.revieweeAvatarUrl,
          role: 'employee' as const,
        };
        assignedReviewees.push(u);
      }
    }

    return [...cycleParticipantUsers, ...assignedReviewees].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [selectedCycle, usersMap, assignments]);

  const reviewerWorkloads = useMemo(() => {
    if (!selectedCycle) return [];
    const map = new Map<string, {
      reviewerId: string;
      reviewerName: string;
      reviewerAvatarUrl?: string;
      total: number;
      completed: number;
      inProgress: number;
      pending: number;
      assignments: PeerReviewAssignment[];
    }>();

    for (const a of assignments) {
      let item = map.get(a.reviewerId);
      if (!item) {
        item = {
          reviewerId: a.reviewerId,
          reviewerName: a.reviewerName,
          reviewerAvatarUrl: a.reviewerAvatarUrl,
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          assignments: [],
        };
        map.set(a.reviewerId, item);
      }
      item.total += 1;
      if (a.status === 'completed') item.completed += 1;
      else if (a.status === 'in_progress') item.inProgress += 1;
      else item.pending += 1;
      item.assignments.push(a);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.reviewerName.localeCompare(b.reviewerName));
  }, [selectedCycle, assignments]);
  
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const [questionnairesData, usersData, cyclesData] = await Promise.all([
            getActiveQuestionnairesAction('peer'),
            getUsersAction(),
            getActiveReviewCyclesAction()
        ]);
        setAllQuestionnaires(questionnairesData);
        setUsers(usersData);
        const uMap = new Map(usersData.map(u => [u.id, u]));
        setUsersMap(uMap);
        setReviewCycles(cyclesData);
        if (cyclesData.length > 0) {
          setSelectedCycleId(cyclesData[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch page data", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load required data." });
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [toast]);

  useEffect(() => {
    const fetchAssignments = async () => {
        if (!selectedCycleId) {
            setAssignments([]);
            return;
        };
        try {
            setIsLoading(true);
            const assignmentsData = await getAssignmentsByCycleAction(selectedCycleId);
            setAssignments(assignmentsData);
        } catch (error) {
            console.error("Failed to fetch assignments for cycle", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load assignments for the selected cycle." });
        } finally {
            setIsLoading(false);
        }
    };
    fetchAssignments();
  }, [selectedCycleId, toast]);
  

  const handleSaveAssignment = async (data: any) => {
    setIsSaving(true);
    try {
      await saveAssignmentAction(data);
      toast({ title: "Success", description: "Assignment saved successfully." });
      closeForm();
      const assignmentsData = await getAssignmentsByCycleAction(selectedCycleId);
      setAssignments(assignmentsData);
    } catch(error) {
       console.error("Failed to save assignment", error);
       toast({ variant: "destructive", title: "Error", description: "Could not save assignment." });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAddNew = (revieweeId?: string) => {
    setEditingAssignment(undefined);
    setPreselectedRevieweeId(typeof revieweeId === 'string' ? revieweeId : undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (assignment: PeerReviewAssignment) => {
    setEditingAssignment(assignment);
    setPreselectedRevieweeId(undefined);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (id: string) => {
    try {
      await deleteAssignmentAction(id);
      toast({ title: "Assignment Deleted", description: "Assignment has been removed." });
      const assignmentsData = await getAssignmentsByCycleAction(selectedCycleId);
      setAssignments(assignmentsData);
    } catch(error) {
        console.error("Failed to delete assignment", error);
        toast({ variant: "destructive", title: "Error", description: "Could not delete assignment." });
    }
  };

  const handleClearSubmittedReview = async (id: string) => {
    try {
      await clearSubmittedReviewAction(id);
      toast({
        title: "Review Cleared",
        description: "Submitted review has been cleared. The reviewer can now redo their review.",
      });
      const assignmentsData = await getAssignmentsByCycleAction(selectedCycleId);
      setAssignments(assignmentsData);
    } catch(error) {
      console.error("Failed to clear submitted review", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not clear submitted review.",
      });
    }
  };

  const handleClearAllSubmittedReviews = async () => {
    if (!selectedCycleId) return;
    try {
      setIsLoading(true);
      const result = await clearAllSubmittedReviewsAction(selectedCycleId);
      toast({
        title: "Reviews Cleared",
        description: `${result.count} submitted review(s) cleared. Reviewers can now redo them.`,
      });
      const assignmentsData = await getAssignmentsByCycleAction(selectedCycleId);
      setAssignments(assignmentsData);
    } catch(error) {
      console.error("Failed to clear all submitted reviews", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not clear submitted reviews for this cycle.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignReviewer = async (reviewee: User, reviewer: User) => {
    if (!selectedCycle) return;
    if (reviewee.id === reviewer.id) {
      toast({
        variant: "destructive",
        title: "Cannot Assign",
        description: "A user cannot be assigned to review themselves.",
      });
      return;
    }

    const alreadyAssigned = assignments.some(
      a => a.revieweeId === reviewee.id && a.reviewerId === reviewer.id
    );
    if (alreadyAssigned) {
      toast({
        title: "Already Assigned",
        description: `${reviewer.name} is already assigned to review ${reviewee.name}.`,
      });
      return;
    }

    const targetQuestionnaire = allQuestionnaires.find(q => q.isActive) || allQuestionnaires[0];
    if (!targetQuestionnaire) {
      toast({
        variant: "destructive",
        title: "Missing Questionnaire",
        description: "No active peer review questionnaire found. Please create one in Questionnaires first.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await saveAssignmentAction({
        reviewCycleId: selectedCycle.id,
        reviewee,
        reviewer,
        questionnaireId: targetQuestionnaire.id,
        status: 'pending',
        dueDate: selectedCycle.endDate,
      });
      toast({
        title: "Reviewer Assigned",
        description: `${reviewer.name} has been assigned to review ${reviewee.name}.`,
      });
      const assignmentsData = await getAssignmentsByCycleAction(selectedCycle.id);
      setAssignments(assignmentsData);
    } catch (error) {
      console.error("Failed to assign reviewer:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not assign reviewer.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignAdmin = (reviewee: User, adminUser: User) => {
    return handleAssignReviewer(reviewee, adminUser);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingAssignment(undefined);
    setPreselectedRevieweeId(undefined);
  };

  const renderAssignmentStatusBadge = (status: PeerReviewAssignment['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-medium capitalize">
            Completed
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-medium capitalize">
            In Progress
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-medium capitalize">
            Pending
          </Badge>
        );
      case 'declined':
      default:
        return (
          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-medium capitalize">
            Declined
          </Badge>
        );
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Peer Review Assignments</h1>
            <p className="text-xs text-muted-foreground">Manage reviewer-to-reviewee pairings and survey questionnaires for active cycles</p>
          </div>
          <Button onClick={() => handleAddNew()} disabled={!selectedCycle} size="sm" className="h-9 font-medium shadow-xs">
            <PlusCircle className="mr-1.5 h-4 w-4" /> Create New Assignment
          </Button>
        </div>

        {isFormOpen && selectedCycle ? (
          <AssignmentForm 
            assignment={editingAssignment}
            initialRevieweeId={preselectedRevieweeId}
            cycle={selectedCycle}
            users={users}
            questionnaires={allQuestionnaires}
            onSave={handleSaveAssignment} 
            onCancel={closeForm}
            isSaving={isSaving}
          />
        ) : (
          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-base font-semibold font-headline">Cycle Pairings</CardTitle>
                  <CardDescription className="text-xs">Oversee reviewer assignments and completion status</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {completedAssignmentsCount > 0 && selectedCycle && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Clear Submitted ({completedAssignmentsCount})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear All Submitted Reviews?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will clear all {completedAssignmentsCount} submitted review(s) for the cycle &apos;{selectedCycle.name}&apos; and reset them to pending so reviewers can redo them. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleClearAllSubmittedReviews}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Clear All ({completedAssignmentsCount}) Reviews
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Select value={selectedCycleId} onValueChange={setSelectedCycleId} disabled={isLoading}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                      <SelectValue placeholder="Select a review cycle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {reviewCycles.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !selectedCycle ? (
                <div className="text-center py-12">
                  <UserCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-sm font-semibold text-foreground">Select a review cycle</h3>
                  <p className="text-xs text-muted-foreground mt-1">Please select an evaluation cycle above to view assignments.</p>
                </div>
              ) : (
                <Tabs defaultValue="by-reviewee" className="w-full">
                  <div className="px-6 pt-3 pb-0 border-b border-border/50">
                    <TabsList className="h-9 bg-muted/60 p-0.5">
                      <TabsTrigger value="by-reviewee" className="text-xs gap-1.5 cursor-pointer">
                        <Users className="h-3.5 w-3.5" />
                        By Reviewee
                        {revieweesList.length > 0 && (
                          <span className="ml-1 rounded-full bg-background px-1.5 py-0.2 text-[10px] text-muted-foreground font-semibold shadow-2xs">
                            {revieweesList.length}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="reviewer-workload" className="text-xs gap-1.5 cursor-pointer">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Reviewer Workload
                        {reviewerWorkloads.length > 0 && (
                          <span className="ml-1 rounded-full bg-background px-1.5 py-0.2 text-[10px] text-muted-foreground font-semibold shadow-2xs">
                            {reviewerWorkloads.length}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="all-pairings" className="text-xs gap-1.5 cursor-pointer">
                        <ListFilter className="h-3.5 w-3.5" />
                        All Pairings
                        {assignments.length > 0 && (
                          <span className="ml-1 rounded-full bg-background px-1.5 py-0.2 text-[10px] text-muted-foreground font-semibold shadow-2xs">
                            {assignments.length}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Tab 1: By Reviewee (1 line per Reviewee with Initial badges) */}
                  <TabsContent value="by-reviewee" className="m-0">
                    {revieweesList.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6 w-[280px]">
                              Reviewee
                            </TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Reviewers
                            </TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[180px]">
                              Admin Reviewer
                            </TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6 w-[150px]">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {revieweesList.map((reviewee) => {
                            const revieweeAssignments = assignments.filter(a => a.revieweeId === reviewee.id);
                            return (
                              <TableRow key={reviewee.id} className="hover:bg-muted/20 transition-colors">
                                <TableCell className="pl-6">
                                  <div className="flex items-center gap-2.5">
                                    <Avatar className="h-8 w-8 ring-1 ring-border">
                                      <AvatarImage src={reviewee.avatarUrl} alt={reviewee.name} />
                                      <AvatarFallback className="text-xs font-semibold">
                                        {getInitials(reviewee.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                        {reviewee.name}
                                        {reviewee.role === 'admin' && (
                                          <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal">
                                            Admin
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">{reviewee.email}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {revieweeAssignments.length > 0 ? (
                                    <div className="flex items-center flex-wrap gap-1.5">
                                      {revieweeAssignments.map((a) => (
                                        <ReviewerInitialBadge
                                          key={a.id}
                                          assignment={a}
                                          allQuestionnaires={allQuestionnaires}
                                          onEdit={handleEdit}
                                          onDelete={handleDelete}
                                          onClearReview={handleClearSubmittedReview}
                                        />
                                      ))}
                                      <span className="text-[11px] text-muted-foreground ml-1.5 font-medium">
                                        ({revieweeAssignments.length})
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">
                                      No reviewers assigned
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <AdminShortcutButton
                                    reviewee={reviewee}
                                    adminUsers={adminUsers}
                                    assignmentsForReviewee={revieweeAssignments}
                                    isSaving={isSaving}
                                    onAssignAdmin={handleAssignAdmin}
                                  />
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <AddReviewerDropdown
                                    reviewee={reviewee}
                                    users={users}
                                    cycle={selectedCycle}
                                    assignmentsForReviewee={revieweeAssignments}
                                    isSaving={isSaving}
                                    onAssignReviewer={handleAssignReviewer}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-12">
                        <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="text-sm font-semibold text-foreground">No participants found</h3>
                        <p className="text-xs text-muted-foreground mt-1 mb-4">Add participants to &apos;{selectedCycle.name}&apos; in Review Cycles to begin assigning reviewers.</p>
                        <Button size="sm" onClick={() => handleAddNew()}>Create First Assignment</Button>
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab 2: Reviewer Workload */}
                  <TabsContent value="reviewer-workload" className="m-0">
                    <div className="p-6 space-y-6">
                      {/* Metric cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg border bg-card/60 shadow-2xs">
                          <div className="text-xs font-medium text-muted-foreground">Active Reviewers</div>
                          <div className="text-2xl font-bold mt-1 text-foreground font-headline">{reviewerWorkloads.length}</div>
                        </div>
                        <div className="p-4 rounded-lg border bg-card/60 shadow-2xs">
                          <div className="text-xs font-medium text-muted-foreground">Total Reviews Assigned</div>
                          <div className="text-2xl font-bold mt-1 text-foreground font-headline">{assignments.length}</div>
                        </div>
                        <div className="p-4 rounded-lg border bg-card/60 shadow-2xs">
                          <div className="text-xs font-medium text-muted-foreground">Avg Reviews / Reviewer</div>
                          <div className="text-2xl font-bold mt-1 text-foreground font-headline">
                            {reviewerWorkloads.length > 0 ? (assignments.length / reviewerWorkloads.length).toFixed(1) : '0'}
                          </div>
                        </div>
                        <div className="p-4 rounded-lg border bg-card/60 shadow-2xs">
                          <div className="text-xs font-medium text-muted-foreground">Overall Completion</div>
                          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 font-headline">
                            {assignments.length > 0 ? Math.round((completedAssignmentsCount / assignments.length) * 100) : 0}%
                          </div>
                        </div>
                      </div>

                      {/* Workload Table */}
                      {reviewerWorkloads.length > 0 ? (
                        <div className="rounded-md border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6 w-[260px]">
                                  Reviewer
                                </TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[150px]">
                                  Reviews To Do
                                </TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[220px]">
                                  Completion Progress
                                </TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Assigned Reviewees
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reviewerWorkloads.map((item) => {
                                const pct = Math.round((item.completed / item.total) * 100);
                                return (
                                  <TableRow key={item.reviewerId} className="hover:bg-muted/20 transition-colors">
                                    <TableCell className="pl-6">
                                      <div className="flex items-center gap-2.5">
                                        <Avatar className="h-8 w-8 ring-1 ring-border">
                                          <AvatarImage src={item.reviewerAvatarUrl} alt={item.reviewerName} />
                                          <AvatarFallback className="text-xs font-semibold">
                                            {getInitials(item.reviewerName)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <div className="text-sm font-medium text-foreground">{item.reviewerName}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {usersMap.get(item.reviewerId)?.email || ''}
                                          </div>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge
                                        variant="secondary"
                                        className="font-semibold text-xs px-2.5 py-0.5"
                                      >
                                        {item.total} {item.total === 1 ? 'review' : 'reviews'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="text-muted-foreground">{pct}% completed</span>
                                          <span className="font-medium text-foreground">{item.completed}/{item.total}</span>
                                        </div>
                                        <Progress value={pct} className="h-2" />
                                        <div className="flex items-center gap-2 text-[11px] pt-0.5 flex-wrap">
                                          {item.completed > 0 && (
                                            <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                                              {item.completed} done
                                            </span>
                                          )}
                                          {item.inProgress > 0 && (
                                            <span className="inline-flex items-center text-blue-600 dark:text-blue-400">
                                              {item.inProgress} in progress
                                            </span>
                                          )}
                                          {item.pending > 0 && (
                                            <span className="inline-flex items-center text-amber-600 dark:text-amber-400">
                                              {item.pending} pending
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {item.assignments.map((a) => (
                                          <Tooltip key={a.id}>
                                            <TooltipTrigger asChild>
                                              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 hover:bg-muted text-xs border transition-colors cursor-default">
                                                <Avatar className="h-4 w-4">
                                                  <AvatarImage src={a.revieweeAvatarUrl} alt={a.revieweeName} />
                                                  <AvatarFallback className="text-[8px]">{getInitials(a.revieweeName)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-foreground">{a.revieweeName}</span>
                                                <span className={cn(
                                                  "h-1.5 w-1.5 rounded-full",
                                                  a.status === 'completed' ? 'bg-emerald-500' :
                                                  a.status === 'in_progress' ? 'bg-blue-500' : 'bg-amber-500'
                                                )} />
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                              <div className="font-semibold">{a.revieweeName}</div>
                                              <div className="capitalize text-muted-foreground">Status: {a.status.replace('_', ' ')}</div>
                                            </TooltipContent>
                                          </Tooltip>
                                        ))}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                          <h3 className="text-sm font-semibold text-foreground">No reviewer workloads yet</h3>
                          <p className="text-xs text-muted-foreground mt-1">Assign reviewers to reviewees to track review workload distributions.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Tab 3: All Pairings (Original Flat Table) */}
                  <TabsContent value="all-pairings" className="m-0">
                    {assignments.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Reviewee</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reviewer</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Questionnaire</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Date</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignments.map((a) => (
                            <TableRow key={a.id} className="hover:bg-muted/20 transition-colors">
                              <TableCell className="font-medium flex items-center pl-6">
                                <Avatar className="h-7 w-7 mr-2.5 ring-1 ring-border">
                                  <AvatarImage src={a.revieweeAvatarUrl} alt={a.revieweeName} />
                                  <AvatarFallback className="text-[10px]">{getInitials(a.revieweeName)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium text-foreground">{a.revieweeName}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <Avatar className="h-7 w-7 mr-2.5 ring-1 ring-border">
                                    <AvatarImage src={a.reviewerAvatarUrl} alt={a.reviewerName} />
                                    <AvatarFallback className="text-[10px]">{getInitials(a.reviewerName)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm text-foreground">{a.reviewerName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {allQuestionnaires.find(q => q.id === a.questionnaireId)?.name || a.questionnaireId}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(parseISO(a.dueDate), "MMM dd, yyyy")}
                              </TableCell>
                              <TableCell className="text-center">
                                {renderAssignmentStatusBadge(a.status)}
                              </TableCell>
                              <TableCell className="text-right space-x-1 pr-6">
                                {a.status === 'completed' && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Clear submitted review so it can be redone"
                                        className="text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Clear Submitted Review?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to clear the submitted review by <span className="font-semibold">{a.reviewerName}</span> for <span className="font-semibold">{a.revieweeName}</span>?
                                          <br /><br />
                                          This will reset the assignment status to pending and remove any submitted responses so the reviewer can redo their review.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleClearSubmittedReview(a.id)}>
                                          Clear Review
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(a)} title="Edit">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete Assignment">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete assignment?</AlertDialogTitle>
                                      <AlertDialogDescription className="text-xs text-muted-foreground">This will permanently delete this review pairing. This action cannot be reversed.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                                      <AlertDialogAction className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(a.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-12">
                        <UserCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="text-sm font-semibold text-foreground">No assignments for this cycle</h3>
                        <p className="text-xs text-muted-foreground mt-1 mb-4">Create reviewer pairings for &apos;{selectedCycle.name}&apos; to start the peer evaluation process.</p>
                        <Button size="sm" onClick={() => handleAddNew()}>Create First Assignment</Button>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
