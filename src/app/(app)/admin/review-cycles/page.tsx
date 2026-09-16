
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, CalendarIcon, Loader2, Users, X, ChevronsUpDown, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { ReviewCycle, User } from '@/types';
import { cn } from '@/lib/utils';
import { getReviewCyclesAction, saveReviewCycleAction } from './actions';
import { getUsersAction } from '../staff/actions';
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Reusable Multi User Select Component ---
const UserMultiSelect = ({ allUsers, selectedUserIds, onChange, disabled = false }: { allUsers: User[], selectedUserIds: string[], onChange: (ids: string[]) => void, disabled?: boolean }) => {
    const [open, setOpen] = useState(false);
    
    const selectedUsers = useMemo(() => allUsers.filter(u => selectedUserIds.includes(u.id)), [allUsers, selectedUserIds]);
    const availableUsers = useMemo(() => allUsers.filter(u => !selectedUserIds.includes(u.id)), [allUsers, selectedUserIds]);

    const handleSelect = (userId: string) => {
        onChange([...selectedUserIds, userId]);
    };

    const handleDeselect = (userId: string) => {
        onChange(selectedUserIds.filter(id => id !== userId));
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild disabled={disabled}>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-auto min-h-10">
                    <div className="flex flex-wrap gap-1">
                        {selectedUsers.length > 0 ? selectedUsers.map(user => (
                            <Badge key={user.id} variant="secondary" className="pl-2">
                                <Avatar className="h-4 w-4 mr-1">
                                <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user avatar small" />
                                <AvatarFallback>{user.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                {user.name}
                                <span role="button" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); handleDeselect(user.id); }} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 cursor-pointer"><X className="h-3 w-3" /></span>
                            </Badge>
                        )) : (
                            <span className="text-muted-foreground">Select participants...</span>
                        )}
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search user..." />
                    <CommandList>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup>
                            {availableUsers.map((user) => (
                            <CommandItem key={user.id} value={user.name} onSelect={() => handleSelect(user.id)}>
                                <div className="flex items-center">
                                    <Avatar className="h-5 w-5 mr-2">
                                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                                        <AvatarFallback>{user.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
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


const ReviewCycleForm = ({
  cycle,
  users,
  onSave,
  onCancel,
  isSaving,
}: {
  cycle?: Partial<ReviewCycle>;
  users: User[];
  onSave: (data: Omit<ReviewCycle, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) => {
  const [name, setName] = useState(cycle?.name || '');
  const [status, setStatus] = useState<ReviewCycle['status']>(cycle?.status || 'draft');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: cycle?.startDate ? parseISO(cycle.startDate) : undefined,
      to: cycle?.endDate ? parseISO(cycle.endDate) : undefined,
  });
  const [participantIds, setParticipantIds] = useState<string[]>(cycle?.participantIds || []);
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!name || !dateRange?.from || !dateRange?.to || participantIds.length === 0) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please fill out all fields to save the cycle." });
      return;
    }
    onSave({
        id: cycle?.id,
        name,
        status,
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        participantIds
    });
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{cycle?.id ? 'Edit' : 'Create New'} Review Cycle</DialogTitle>
        <DialogDescription>Define the timeline, participants, and status for a review period.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-6 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Cycle Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="date" className="text-right">Date Range</Label>
          <div className="col-span-3">
             <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
          </div>
        </div>
         <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="status" className="text-right">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ReviewCycle['status'])}>
              <SelectTrigger id="status" className="col-span-3">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
        </div>
        <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Participants</Label>
            <div className="col-span-3">
                <UserMultiSelect allUsers={users} selectedUserIds={participantIds} onChange={setParticipantIds} />
            </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Cycle
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export default function AdminReviewCyclesPage() {
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Partial<ReviewCycle> | undefined>(undefined);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [cyclesData, usersData] = await Promise.all([
        getReviewCyclesAction(),
        getUsersAction()
      ]);
      setCycles(cyclesData);
      setUsers(usersData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load required page data." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveCycle = async (data: Parameters<typeof saveReviewCycleAction>[0]) => {
    try {
      setIsSaving(true);
      await saveReviewCycleAction(data);
      toast({ title: "Success", description: "Review cycle saved successfully." });
      closeForm();
      fetchData(); // Refresh data
    } catch (error) {
      console.error("Failed to save review cycle:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save review cycle." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNew = () => {
    setEditingCycle(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (cycle: ReviewCycle) => {
    setEditingCycle(cycle);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCycle(undefined);
  };
  
  const renderStatusBadge = (status: ReviewCycle['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-medium capitalize">
            Active
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium capitalize">
            Draft
          </Badge>
        );
      case 'closed':
      default:
        return (
          <Badge variant="outline" className="border-muted-foreground/30 bg-muted/60 text-muted-foreground text-xs font-medium capitalize">
            Closed
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Manage Review Cycles</h1>
          <p className="text-xs text-muted-foreground">Define evaluation timelines, participants, and company-wide cycle schedules</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew} size="sm" className="h-9 font-medium shadow-sm">
              <PlusCircle className="mr-1.5 h-4 w-4" /> Create New Cycle
            </Button>
          </DialogTrigger>
          {isFormOpen && (
            <ReviewCycleForm
                cycle={editingCycle}
                users={users}
                onSave={handleSaveCycle}
                onCancel={closeForm}
                isSaving={isSaving}
            />
          )}
        </Dialog>
      </div>

      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold font-headline">Evaluation Cycles</CardTitle>
              <CardDescription className="text-xs">Oversee all past, present, and scheduled review periods</CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs font-medium">
              {cycles.length} Cycles
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
             <div className="flex justify-center items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : cycles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Cycle Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Range</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Participants</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-medium text-sm text-foreground pl-6">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(c.startDate), "MMM dd, yyyy")} - {format(parseISO(c.endDate), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-center text-xs font-medium">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
                        {c.participantIds.length} members
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {renderStatusBadge(c.status)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(c)} title="Edit Cycle">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="text-center py-12">
                <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No review cycles created</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Set up your organization's first review cycle to begin collecting feedback.</p>
                <Button size="sm" onClick={handleAddNew}>Create First Cycle</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
