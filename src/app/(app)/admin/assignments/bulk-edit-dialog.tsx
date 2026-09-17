"use client";

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckSquare, Loader2, Info } from 'lucide-react';
import type { PeerReviewAssignment, Questionnaire, ReviewCycle } from '@/types';
import { bulkUpdateAssignmentQuestionnaireAction } from './actions';
import { useToast } from '@/hooks/use-toast';

interface BulkEditQuestionnaireDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cycle: ReviewCycle;
  assignments: PeerReviewAssignment[];
  selectedAssignmentIds: Set<string>;
  questionnaires: Questionnaire[];
  onSuccess: () => Promise<void> | void;
}

type BulkScope = 'selected' | 'all' | 'by_current';

export function BulkEditQuestionnaireDialog({
  isOpen,
  onClose,
  cycle,
  assignments,
  selectedAssignmentIds,
  questionnaires,
  onSuccess,
}: BulkEditQuestionnaireDialogProps) {
  const { toast } = useToast();
  const [scope, setScope] = useState<BulkScope>(
    selectedAssignmentIds.size > 0 ? 'selected' : 'all'
  );
  const [filterQuestionnaireId, setFilterQuestionnaireId] = useState<string>('');
  const [targetQuestionnaireId, setTargetQuestionnaireId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Distinct questionnaires currently in use for this cycle
  const distinctCurrentQuestionnaires = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const a of assignments) {
      const existing = map.get(a.questionnaireId);
      const qObj = questionnaires.find(q => q.id === a.questionnaireId);
      const name = qObj ? `${qObj.name} (v${qObj.version})` : 'Unknown Questionnaire';
      if (existing) {
        existing.count += 1;
      } else {
        map.set(a.questionnaireId, { id: a.questionnaireId, name, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [assignments, questionnaires]);

  // Reset/sync state when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (selectedAssignmentIds.size > 0) {
        setScope('selected');
      } else {
        setScope('all');
      }
      if (distinctCurrentQuestionnaires.length > 0) {
        setFilterQuestionnaireId(distinctCurrentQuestionnaires[0].id);
      }
      const activeQ = questionnaires.find(q => q.isActive) || questionnaires[0];
      if (activeQ) {
        setTargetQuestionnaireId(activeQ.id);
      }
    }
  }, [isOpen, selectedAssignmentIds.size, distinctCurrentQuestionnaires, questionnaires]);

  // Target assignments according to scope
  const targetAssignments = useMemo(() => {
    if (scope === 'selected') {
      return assignments.filter(a => selectedAssignmentIds.has(a.id));
    }
    if (scope === 'by_current') {
      return assignments.filter(a => a.questionnaireId === filterQuestionnaireId);
    }
    return assignments;
  }, [scope, assignments, selectedAssignmentIds, filterQuestionnaireId]);

  const completedCount = useMemo(() => {
    return targetAssignments.filter(a => a.status === 'completed').length;
  }, [targetAssignments]);

  const alreadyUsingTargetCount = useMemo(() => {
    if (!targetQuestionnaireId) return 0;
    return targetAssignments.filter(a => a.questionnaireId === targetQuestionnaireId).length;
  }, [targetAssignments, targetQuestionnaireId]);

  const selectedTargetQ = useMemo(() => {
    return questionnaires.find(q => q.id === targetQuestionnaireId);
  }, [questionnaires, targetQuestionnaireId]);

  const handleSubmit = async () => {
    if (!targetQuestionnaireId || targetAssignments.length === 0) return;

    setIsSubmitting(true);
    try {
      const ids = targetAssignments.map(a => a.id);
      const result = await bulkUpdateAssignmentQuestionnaireAction(ids, targetQuestionnaireId);
      toast({
        title: "Questionnaires Updated",
        description: `Successfully updated questionnaire to "${selectedTargetQ?.name || 'Selected'}" for ${result.count} assignment(s).`,
      });
      await onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to bulk update assignment questionnaires", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not update the questionnaire for the selected assignments.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CheckSquare className="h-5 w-5 text-primary" />
            Bulk Edit Questionnaire
          </DialogTitle>
          <DialogDescription className="text-xs">
            Update the assigned questionnaire for peer reviews in <span className="font-medium text-foreground">{cycle.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">Apply update to</Label>
            <RadioGroup
              value={scope}
              onValueChange={(val) => setScope(val as BulkScope)}
              className="space-y-2"
            >
              {selectedAssignmentIds.size > 0 && (
                <label
                  htmlFor="scope-selected"
                  className={`flex items-start space-x-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                    scope === 'selected' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <RadioGroupItem value="selected" id="scope-selected" className="mt-0.5" />
                  <div className="space-y-0.5 flex-1 text-xs">
                    <div className="font-medium text-foreground flex items-center justify-between">
                      <span>Selected assignments</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {selectedAssignmentIds.size} selected
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Only update the {selectedAssignmentIds.size} assignments currently checked in the table.
                    </p>
                  </div>
                </label>
              )}

              <label
                htmlFor="scope-all"
                className={`flex items-start space-x-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  scope === 'all' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                }`}
              >
                <RadioGroupItem value="all" id="scope-all" className="mt-0.5" />
                <div className="space-y-0.5 flex-1 text-xs">
                  <div className="font-medium text-foreground flex items-center justify-between">
                    <span>All assignments in this cycle</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {assignments.length} total
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Update every assignment created for this evaluation cycle.
                  </p>
                </div>
              </label>

              {distinctCurrentQuestionnaires.length > 1 && (
                <label
                  htmlFor="scope-by-current"
                  className={`flex items-start space-x-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                    scope === 'by_current' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <RadioGroupItem value="by_current" id="scope-by-current" className="mt-0.5" />
                  <div className="space-y-1.5 flex-1 text-xs">
                    <div className="font-medium text-foreground">
                      Filter by current questionnaire
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Only update assignments currently using a specific questionnaire template.
                    </p>
                    {scope === 'by_current' && (
                      <div className="pt-1">
                        <Select
                          value={filterQuestionnaireId}
                          onValueChange={setFilterQuestionnaireId}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select current questionnaire..." />
                          </SelectTrigger>
                          <SelectContent>
                            {distinctCurrentQuestionnaires.map(q => (
                              <SelectItem key={q.id} value={q.id} className="text-xs">
                                {q.name} ({q.count} assignment{q.count === 1 ? '' : 's'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </label>
              )}
            </RadioGroup>
          </div>

          {/* Target questionnaire selector */}
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="target-questionnaire" className="text-xs font-medium text-foreground">
              New Questionnaire to Assign
            </Label>
            <Select
              value={targetQuestionnaireId}
              onValueChange={setTargetQuestionnaireId}
            >
              <SelectTrigger id="target-questionnaire" className="h-9 text-xs">
                <SelectValue placeholder="Select new questionnaire..." />
              </SelectTrigger>
              <SelectContent>
                {questionnaires.map((q) => (
                  <SelectItem key={q.id} value={q.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span>{q.name} (v{q.version})</span>
                      {q.isActive && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-300 text-emerald-700 dark:text-emerald-400">
                          Active
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary / Impact preview */}
          <div className="rounded-md bg-muted/40 p-3 space-y-2 border border-border/60 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Assignments affected:</span>
              <span className="font-semibold text-foreground">
                {targetAssignments.length} assignment{targetAssignments.length === 1 ? '' : 's'}
              </span>
            </div>

            {alreadyUsingTargetCount > 0 && alreadyUsingTargetCount === targetAssignments.length && (
              <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 text-[11px]">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>All {targetAssignments.length} target assignment(s) are already using this questionnaire.</span>
              </div>
            )}

            {completedCount > 0 && (
              <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 text-[11px]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {completedCount} assignment{completedCount === 1 ? ' is' : 's are'} already completed. Updating the questionnaire updates the template reference for future re-reviews, but won&apos;t alter submitted review responses.
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              targetAssignments.length === 0 ||
              !targetQuestionnaireId ||
              alreadyUsingTargetCount === targetAssignments.length
            }
            className="text-xs"
          >
            {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Update {targetAssignments.length} Assignment{targetAssignments.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
