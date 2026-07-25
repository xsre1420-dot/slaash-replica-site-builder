import { Badge } from '@/components/ui/badge';
import type { LeadStatus, SubscriptionStatus } from '@/types/leads';
import { LEAD_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from '@/types/leads';
import { WORKFLOW_STAGE_STYLES, getLeadWorkflowStage } from '@/utils/leadWorkflowUtils';
import type { LeadRecord } from '@/types/leads';
import { cn } from '@/lib/utils';

type SubscriptionStatusBadgeProps =
  | { type: 'subscription'; status: SubscriptionStatus; className?: string }
  | { type: 'lead'; status: LeadStatus; className?: string }
  | { type: 'workflow'; lead: LeadRecord; className?: string };

const SUBSCRIPTION_STYLES: Record<SubscriptionStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25',
  expired: 'bg-slate-500/10 text-slate-700 border-slate-500/25',
  suspended: 'bg-amber-500/10 text-amber-800 border-amber-500/25',
};

const LEAD_STYLES: Record<LeadStatus, string> = {
  new: 'bg-blue-500/10 text-blue-700 border-blue-500/25',
  contacted: 'bg-sky-500/10 text-sky-800 border-sky-500/25',
  interested: 'bg-violet-500/10 text-violet-800 border-violet-500/25',
  customer: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25',
  rejected: 'bg-slate-500/10 text-slate-600 border-slate-500/25',
};

const SubscriptionStatusBadge = (props: SubscriptionStatusBadgeProps) => {
  if (props.type === 'workflow') {
    const stage = getLeadWorkflowStage(props.lead);
    const { label, className: stageClass } = WORKFLOW_STAGE_STYLES[stage];
    return (
      <Badge variant="outline" className={cn('sub-status-badge font-normal', stageClass, props.className)}>
        {label}
      </Badge>
    );
  }

  if (props.type === 'subscription') {
    return (
      <Badge
        variant="outline"
        className={cn('sub-status-badge font-normal', SUBSCRIPTION_STYLES[props.status], props.className)}
      >
        {SUBSCRIPTION_STATUS_LABELS[props.status]}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn('sub-status-badge font-normal', LEAD_STYLES[props.status], props.className)}
    >
      {LEAD_STATUS_LABELS[props.status]}
    </Badge>
  );
};

export default SubscriptionStatusBadge;
