
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Edit, Trash2, FileText, Users, X, GripVertical, Loader2 } from 'lucide-react';
import type { Questionnaire, Question } from '@/types';
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLatestQuestionnairesAction, saveQuestionnaireAction, deactivateQuestionnaireTemplateAction } from './actions';
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const emptyQuestionnaire: Partial<Questionnaire> = {
  name: '',
  description: '',
  type: 'self',
  questions: [{ id: Date.now().toString(), text: '', order: 1 }],
  isActive: true,
};

const QuestionnaireForm = ({ 
  questionnaire, 
  onSave, 
  onCancel,
  isSaving
}: { 
  questionnaire?: Partial<Questionnaire>, 
  onSave: (q: Partial<Questionnaire>) => void, 
  onCancel: () => void,
  isSaving: boolean
}) => {
  const [formData, setFormData] = useState<Partial<Questionnaire>>(
    questionnaire ? { ...questionnaire } : { ...emptyQuestionnaire }
  );

  const handleInputChange = (field: keyof Omit<Questionnaire, 'id' | 'createdAt' | 'updatedAt' | 'questions' | 'type' | 'isActive'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleQuestionChange = (index: number, text: string) => {
    const newQuestions = [...(formData.questions || [])];
    newQuestions[index].text = text;
    setFormData(prev => ({ ...prev, questions: newQuestions }));
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...(prev.questions || []), { id: Date.now().toString(), text: '', order: (prev.questions?.length || 0) + 1 }]
    }));
  };

  const removeQuestion = (index: number) => {
    if (!formData.questions || formData.questions.length <= 1) return; // Keep at least one question
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    // Re-order
    newQuestions.forEach((q, i) => q.order = i + 1);
    setFormData(prev => ({ ...prev, questions: newQuestions }));
  };
  
  const handleSave = () => {
    if(!formData.name || formData.name.trim() === '') {
      // Add more robust validation as needed
      alert('Questionnaire name is required.');
      return;
    }
    onSave(formData);
  };

  return (
    <DialogContent className="sm:max-w-[625px] max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>{formData.id ? 'Edit' : 'Create New'} Questionnaire</DialogTitle>
        <DialogDescription>
          {formData.id ? 'Modify the details and create a new version of this questionnaire.' : 'Define a new set of questions for reviews.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">Name</Label>
          <Input id="name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="description" className="text-right">Description</Label>
          <Textarea id="description" value={formData.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} className="col-span-3" rows={2} />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="type" className="text-right">Type</Label>
          <select 
            id="type" 
            value={formData.type} 
            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'self' | 'peer' }))} 
            className="col-span-3 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="self">Self-Review</option>
            <option value="peer">Peer-Review</option>
          </select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="isActive" className="text-right">Active</Label>
          <div className="col-span-3 flex items-center space-x-2">
             <Switch 
                id="isActive" 
                checked={formData.isActive} 
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <span className="text-xs text-muted-foreground">Controls if this can be used for new assignments.</span>
          </div>
        </div>
        <div className="col-span-4 space-y-3 mt-2">
          <Label className="text-base font-medium">Questions</Label>
          {formData.questions?.map((q, index) => (
            <div key={q.id || index} className="flex items-start gap-2">
              <Button variant="ghost" size="icon" className="mt-1 cursor-grab" disabled><GripVertical className="h-4 w-4 text-muted-foreground" /></Button>
              <Textarea
                placeholder={`Question ${index + 1}`}
                value={q.text}
                onChange={(e) => handleQuestionChange(index, e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" onClick={() => removeQuestion(index)} disabled={(formData.questions?.length || 0) <= 1}>
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addQuestion} size="sm" className="mt-2">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Question
          </Button>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Questionnaire'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};


export default function AdminQuestionnairesPage() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState<Partial<Questionnaire> | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestionnaires();
  }, []);

  const fetchQuestionnaires = async () => {
    try {
      setIsLoading(true);
      const data = await getLatestQuestionnairesAction();
      setQuestionnaires(data);
    } catch (error) {
      console.error("Failed to fetch questionnaires:", error);
      toast({
        variant: "destructive",
        title: "Error fetching questionnaires",
        description: "Could not load data from the server. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveQuestionnaire = async (q: Partial<Questionnaire>) => {
    try {
      setIsSaving(true);
      await saveQuestionnaireAction(q as any);
      toast({
        title: "Success",
        description: "Questionnaire saved successfully.",
      });
      setIsFormOpen(false);
      setEditingQuestionnaire(undefined);
      fetchQuestionnaires(); // Refresh the list
    } catch (error) {
       console.error("Failed to save questionnaire:", error);
       toast({
        variant: "destructive",
        title: "Error saving questionnaire",
        description: "An error occurred while saving. Please try again.",
      });
    } finally {
       setIsSaving(false);
    }
  };
  
  const handleAddNew = () => {
    setEditingQuestionnaire(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (q: Questionnaire) => {
    setEditingQuestionnaire(q);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (templateId: string) => {
    try {
      await deactivateQuestionnaireTemplateAction(templateId);
      toast({
        title: "Questionnaire Deactivated",
        description: "The questionnaire template has been deactivated.",
      });
      fetchQuestionnaires();
    } catch (error) {
      console.error("Failed to deactivate questionnaire:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not deactivate the questionnaire.",
      });
    }
  };
  
  const closeForm = () => {
    setIsFormOpen(false); 
    setEditingQuestionnaire(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Manage Questionnaires</h1>
          <p className="text-xs text-muted-foreground">Standardize evaluation criteria and questions for self-assessments and peer surveys</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew} size="sm" className="h-9 font-medium shadow-sm">
              <PlusCircle className="mr-1.5 h-4 w-4" /> Create New Questionnaire
            </Button>
          </DialogTrigger>
          {isFormOpen && (
            <QuestionnaireForm 
              questionnaire={editingQuestionnaire} 
              onSave={handleSaveQuestionnaire} 
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
              <CardTitle className="text-base font-semibold font-headline">Questionnaire Templates</CardTitle>
              <CardDescription className="text-xs">Versioned survey question templates used across review cycles</CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs font-medium">
              {questionnaires.length} Templates
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : questionnaires.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Template Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Survey Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Questions</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Version</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questionnaires.map((q) => (
                  <TableRow key={q.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-medium text-sm text-foreground pl-6">{q.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize text-xs font-medium ${q.type === 'self' ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300' : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'}`}>
                        {q.type === 'self' ? <FileText className="mr-1 h-3 w-3" /> : <Users className="mr-1 h-3 w-3" />}
                        {q.type}-Review
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {q.questions.length} questions
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                        v{q.version}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs font-medium ${q.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {q.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1 pr-6">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(q)} title="Edit (creates new version)">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Deactivate Template">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Deactivate questionnaire template?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-xs text-muted-foreground">
                                      This will deactivate all versions of this questionnaire template and prevent new assignments from using it.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(q.templateId)}>Deactivate</AlertDialogAction>
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
              <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold text-foreground">No questionnaires created</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Define question templates to distribute for performance cycles.</p>
              <Button size="sm" onClick={handleAddNew}>
                Create First Questionnaire
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
