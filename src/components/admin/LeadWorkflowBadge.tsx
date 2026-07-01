import { Badge } from '@/components/ui/badge';
import type { LeadRecord } from '@/types/leads';
import {
  WORKFLOW_STAGE_STYLES,
  getLeadWorkflowStage,
} from '@/utils/leadWorkflowUtils';
import { cn } from '@/lib/utils';

type LeadWorkflowBadgeProps = {
  lead: LeadRecord;
  className?: string;
};

const LeadWorkflowBadge = ({ lead, className }: LeadWorkflowBadgeProps) => {
  const stage = getLeadWorkflowStage(lead);
  const { label, className: stageClassName } = WORKFLOW_STAGE_STYLES[stage];

  return (
    <Badge variant="outline" className={cn('font-normal', stageClassName, className)}>
      {label}
    </Badge>
  );
};

export default LeadWorkflowBadge;
