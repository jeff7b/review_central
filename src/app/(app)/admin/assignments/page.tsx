
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
import { PlusCircle, Edit, Trash2, UserCheck, CalendarIcon, ChevronsUpDown, Loader2, Check, RotateCcw } from 'lucide-react';
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
import { saveAssignmentAction, getAssignmentsByCycleAction, deleteAssignmentAction, clearSubmittedReviewAction, clearAllSubmittedReviewsAction } from './actions';
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
  
  const completedAssignmentsCount = useMemo(() => {
    return assignments.filter(a => a.status === 'completed').length;
  }, [assignments]);
  
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

  const closeForm = () => {
      setIsFormOpen(false);
      setEditingAssignment(undefined);
  }

  const getStatusBadgeVariant = (status: PeerReviewAssignment['status']): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'in_progress': return 'default';
      case 'completed': return 'outline';
      case 'declined': return 'destructive';
      default: return 'default';
    }
  };


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Manage Peer Review Assignments</h1>
         <Button onClick={handleAddNew} disabled={!selectedCycle}>
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Assignment
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
        <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Current Assignments</CardTitle>
                  <CardDescription>Oversee and manage all peer review pairings for the selected review cycle.</CardDescription>
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
                      {reviewCycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !selectedCycle ? (
                <div className="text-center py-10"><UserCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Please select a review cycle to view assignments.</p><p className="text-sm mt-2 text-muted-foreground">No active cycles? <Link href="/admin/review-cycles" className="underline text-primary">Create one here</Link>.</p></div>
            ) : assignments.length > 0 ? (
                <Table>
                <TableHeader><TableRow>
                    <TableHead>Reviewee</TableHead><TableHead>Reviewer</TableHead>
                    <TableHead>Questionnaire</TableHead><TableHead>Due Date</TableHead>
                    <TableHead className="text-center">Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {assignments.map((a) => (
                    <TableRow key={a.id}>
                        <TableCell className="font-medium flex items-center">
                            <Avatar className="h-6 w-6 mr-2"><AvatarImage src={a.revieweeAvatarUrl} alt={a.revieweeName} /><AvatarFallback>{a.revieweeName.split(' ').map(n=>n[0]).join('')}</AvatarFallback></Avatar>
                            {a.revieweeName}
                        </TableCell>
                        <TableCell className="flex items-center">
                            <Avatar className="h-6 w-6 mr-2"><AvatarImage src={a.reviewerAvatarUrl} alt={a.reviewerName} /><AvatarFallback>{a.reviewerName.split(' ').map(n=>n[0]).join('')}</AvatarFallback></Avatar>
                            {a.reviewerName}
                        </TableCell>
                        <TableCell>{allQuestionnaires.find(q => q.id === a.questionnaireId)?.name || a.questionnaireId}</TableCell>
                        <TableCell>{format(parseISO(a.dueDate), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="text-center">
                            <Badge variant={getStatusBadgeVariant(a.status)} className={cn("capitalize", a.status === 'completed' ? 'bg-green-100 text-green-700 border-green-300' : '')}>
                                {a.status.replace('_', ' ')}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
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
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(a)} title="Edit"><Edit className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this assignment. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(a.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            ) : (
                <div className="text-center py-10">
                <UserCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No assignments created for '{selectedCycle.name}' yet.</p>
                 <Button className="mt-4" onClick={handleAddNew}>Create First Assignment</Button>
                </div>
            )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
