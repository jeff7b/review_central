
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, UserCog, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { User } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getUsersAction, saveUserAction, deleteUserAction } from './actions';
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

const UserForm = ({ 
  user, 
  users,
  onSave, 
  onCancel,
  isSaving
}: { 
  user?: Partial<User>, 
  users: User[],
  onSave: (data: Partial<User>) => void, 
  onCancel: () => void,
  isSaving: boolean
}) => {
  const [formData, setFormData] = useState<Partial<User>>(
    user ? { ...user } : { name: '', email: '', role: 'employee', mentorId: null }
  );

  const eligibleMentors = useMemo(() => {
    return users
      .filter(u => !formData.id || u.id !== formData.id)
      .sort((a, b) => {
        const roleRank: Record<User['role'], number> = { admin: 1, team_leader: 2, employee: 3 };
        const rankDiff = (roleRank[a.role] ?? 99) - (roleRank[b.role] ?? 99);
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name);
      });
  }, [users, formData.id]);

  const handleSave = () => {
    if(!formData.name || formData.name.trim() === '' || !formData.email || formData.email.trim() === '') {
      alert('Name and Email are required.');
      return;
    }
    onSave(formData);
  };

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>{formData.id ? 'Edit' : 'Add New'} Staff Member</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">Name</Label>
          <Input id="name" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="email" className="text-right">Email</Label>
          <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(p => ({...p, email: e.target.value}))} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="role" className="text-right">Role</Label>
          <Select 
            value={formData.role} 
            onValueChange={(value) => setFormData(p => ({
              ...p, 
              role: value as User['role'],
              ...(value === 'admin' ? { mentorId: null } : {})
            }))}
          >
            <SelectTrigger id="role" className="col-span-3">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="team_leader">Team Leader</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {formData.role !== 'admin' && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="mentor" className="text-right">Admin/Mentor</Label>
            <Select 
              value={formData.mentorId || 'none'} 
              onValueChange={(value) => setFormData(p => ({...p, mentorId: value === 'none' ? null : value}))}
            >
              <SelectTrigger id="mentor" className="col-span-3">
                <SelectValue placeholder="Select an Admin or Mentor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">None (Unassigned)</span>
                </SelectItem>
                {eligibleMentors.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={m.avatarUrl} alt={m.name} />
                        <AvatarFallback className="text-[10px]">{m.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <span>{m.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">({m.role.replace('_', ' ')})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save User'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default function AdminStaffPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | undefined>(undefined);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await getUsersAction();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({
        variant: "destructive",
        title: "Error fetching users",
        description: "Could not load data from the server.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveUser = async (data: Partial<User>) => {
    try {
      setIsSaving(true);
      await saveUserAction(data as any);
      toast({
        title: "Success",
        description: "User saved successfully.",
      });
      closeForm();
      fetchUsers();
    } catch (error: any) {
       console.error("Failed to save user:", error);
       toast({
        variant: "destructive",
        title: "Error saving user",
        description: error.message || "An error occurred while saving.",
      });
    } finally {
       setIsSaving(false);
    }
  };
  
  const handleAddNew = () => {
    setEditingUser(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (userId: string) => {
    try {
      await deleteUserAction(userId);
      toast({
        title: "User Deleted",
        description: "The user has been removed.",
      });
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not delete the user.",
      });
    }
  };
  
  const closeForm = () => {
    setIsFormOpen(false); 
    setEditingUser(undefined);
  };

  const renderRoleBadge = (role: User['role']) => {
    switch(role) {
      case 'admin':
        return (
          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 text-xs font-medium capitalize">
            Admin
          </Badge>
        );
      case 'team_leader':
        return (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-medium capitalize">
            Team Leader
          </Badge>
        );
      case 'employee':
      default:
        return (
          <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium capitalize">
            Employee
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Manage Staff</h1>
          <p className="text-xs text-muted-foreground">Add, edit, and manage user roles and permissions across your organization</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew} size="sm" className="h-9 font-medium shadow-sm">
              <PlusCircle className="mr-1.5 h-4 w-4" /> Add New Staff
            </Button>
          </DialogTrigger>
          {isFormOpen && (
            <UserForm 
              user={editingUser} 
              users={users}
              onSave={handleSaveUser} 
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
              <CardTitle className="text-base font-semibold font-headline">Directory Members</CardTitle>
              <CardDescription className="text-xs">Active accounts authorized to perform and receive reviews</CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs font-medium">
              {users.length} Users
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Role</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin / Mentor</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const mentor = user.mentorId ? users.find(u => u.id === user.mentorId) : null;
                  return (
                    <TableRow key={user.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium flex items-center pl-6">
                        <Avatar className="h-8 w-8 mr-3 ring-1 ring-border">
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                          <AvatarFallback className="text-xs font-semibold">{user.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-foreground">{user.name}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-center">
                        {renderRoleBadge(user.role)}
                      </TableCell>
                      <TableCell>
                        {user.role === 'admin' ? (
                          <span className="text-xs text-muted-foreground italic">N/A</span>
                        ) : mentor ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6 ring-1 ring-border">
                              <AvatarImage src={mentor.avatarUrl} alt={mentor.name} />
                              <AvatarFallback className="text-[10px] font-semibold">{mentor.name.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground">{mentor.name}</span>
                            {renderRoleBadge(mentor.role)}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs font-normal border-dashed text-muted-foreground">
                            Unassigned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1 pr-6">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(user)} title="Edit User">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete User">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete staff member?</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs text-muted-foreground">
                                This will permanently revoke access for {user.name} and remove their data. This action cannot be reversed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                              <AlertDialogAction className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(user.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <UserCog className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold text-foreground">No staff members found</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Get started by creating your first team member.</p>
              <Button size="sm" onClick={handleAddNew}>
                Add First Staff Member
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
