
"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlusCircle, Edit, Trash2, UserCheck, CalendarIcon, ChevronsUpDown, Loader2, Check } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { getActiveQuestionnairesAction } from '../questionnaires/actions';
import { getActiveReviewCyclesAction } from '../review-cycles/actions';
import { saveAssignmentAction, getAssignmentsByCycleAction, deleteAssignmentAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { getUsersAction } from '../staff/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


const UserCombobox = ({ users, selectedUser, onSelectUser, placeholder, disabled = false }: { users: User[], selectedUser?: User, onSelectUser: (user?: User) => void, placeholder: string, disabled?: boolean }) => {
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
                <AvatarFallback>{selectedUser.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
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
                        <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
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


const AssignmentForm = ({ assignment, cycle, users, questionnaires, onSave, onCancel, isSaving }: { assignment?: PeerReviewAssignment, cycle: ReviewCycle, users: User[], questionnaires: Questionnaire[], onSave: (data: any) => void, onCancel: () => void, isSaving: boolean }) => {
  const getInitialUser = (id?: string) => users.find(u => u.id === id);
  
  const [reviewee, setReviewee] = useState<User | undefined>(getInitialUser(assignment?.revieweeId));
  const [reviewer, setReviewer] = useState<User | undefined>(getInitialUser(assignment?.reviewerId));
  const [questionnaireId, setQuestionnaireId] = useState<string | undefined>(assignment?.questionnaireId);
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
      status: assignment?.status || 'pending',
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
  const { toast } = useToast();

  const selectedCycle = useMemo(() => reviewCycles.find(c => c.id === selectedCycleId), [reviewCycles, selectedCycleId]);
  
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
  
  const handleAddNew = () => {
    setEditingAssignment(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (assignment: PeerReviewAssignment) => {
    setEditingAssignment(assignment);
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

  const closeForm = () => {
      setIsFormOpen(false);
      setEditingAssignment(undefined);
  }

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Peer Review Assignments</h1>
          <p className="text-xs text-muted-foreground">Manage reviewer-to-reviewee pairings and survey questionnaires for active cycles</p>
        </div>
        <Button onClick={handleAddNew} disabled={!selectedCycle} size="sm" className="h-9 font-medium shadow-sm">
          <PlusCircle className="mr-1.5 h-4 w-4" /> Create New Assignment
        </Button>
      </div>

      {isFormOpen && selectedCycle ? (
         <AssignmentForm 
            assignment={editingAssignment}
            cycle={selectedCycle}
            users={users}
            questionnaires={allQuestionnaires}
            onSave={handleSaveAssignment} 
            onCancel={closeForm}
            isSaving={isSaving}
        />
      ) : (
        <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-base font-semibold font-headline">Cycle Pairings</CardTitle>
                  <CardDescription className="text-xs">Oversee reviewer assignments and completion status</CardDescription>
                </div>
                 <Select value={selectedCycleId} onValueChange={setSelectedCycleId} disabled={isLoading}>
                    <SelectTrigger className="w-full sm:w-[240px] h-9 text-xs">
                      <SelectValue placeholder="Select review cycle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {reviewCycles.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
            {isLoading ? (
                <div className="flex justify-center items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : !selectedCycle ? (
                <div className="text-center py-12">
                  <UserCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-sm font-semibold text-foreground">Select a review cycle</h3>
                  <p className="text-xs text-muted-foreground mt-1">Please select an evaluation cycle above to view assignments.</p>
                </div>
            ) : assignments.length > 0 ? (
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
                            <Avatar className="h-7 w-7 mr-2.5 ring-1 ring-border"><AvatarImage src={a.revieweeAvatarUrl} alt={a.revieweeName} /><AvatarFallback className="text-[10px]">{a.revieweeName.split(' ').map(n=>n[0]).join('')}</AvatarFallback></Avatar>
                            <span className="text-sm font-medium text-foreground">{a.revieweeName}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Avatar className="h-7 w-7 mr-2.5 ring-1 ring-border"><AvatarImage src={a.reviewerAvatarUrl} alt={a.reviewerName} /><AvatarFallback className="text-[10px]">{a.reviewerName.split(' ').map(n=>n[0]).join('')}</AvatarFallback></Avatar>
                            <span className="text-sm text-foreground">{a.reviewerName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{allQuestionnaires.find(q => q.id === a.questionnaireId)?.name || a.questionnaireId}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(parseISO(a.dueDate), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="text-center">
                            {renderAssignmentStatusBadge(a.status)}
                        </TableCell>
                        <TableCell className="text-right space-x-1 pr-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(a)} title="Edit Assignment"><Edit className="h-3.5 w-3.5" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete Assignment"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete assignment?</AlertDialogTitle><AlertDialogDescription className="text-xs text-muted-foreground">This will permanently delete this review pairing. This action cannot be reversed.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel><AlertDialogAction className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(a.id)}>Delete</AlertDialogAction></AlertDialogFooter>
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
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Create reviewer pairings for '{selectedCycle.name}' to start the peer evaluation process.</p>
                  <Button size="sm" onClick={handleAddNew}>Create First Assignment</Button>
                </div>
            )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
