import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  MessageCircle,
  Copy,
  Eye,
  PhoneCall,
  Calendar,
  Package,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LeadCodeActionButton from '@/components/admin/LeadCodeActionButton';
import SubscriptionStatusBadge from '@/components/admin/subscription/SubscriptionStatusBadge';
import type { LeadRecord } from '@/types/leads';
import type { AccessCodeRecord } from '@/types/accessCodes';
import { formatLeadRelativeTime } from '@/utils/leadWorkflowUtils';
import { getMonthlyOrderLabel } from '@/data/leadFormOptions';
import { planLabelFor, planLabelForLead } from '@/utils/subscriptionPlanLabels';

type LeadRequestMobileCardProps = {
  lead: LeadRecord;
  activeCode: AccessCodeRecord | null;
  codes: AccessCodeRecord[];
  onWhatsApp: () => void;
  onMarkContacted?: () => void;
  onCopyPhone: () => void;
  onOpenCode: () => void;
};

const LeadRequestMobileCard = ({
  lead,
  activeCode,
  codes,
  onWhatsApp,
  onMarkContacted,
  onCopyPhone,
  onOpenCode,
}: LeadRequestMobileCardProps) => (
  <article className="sub-request-card">
    <div className="sub-request-card__header">
      <div className="sub-request-card__avatar" aria-hidden>
        {lead.full_name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="sub-request-card__name">{lead.full_name}</h3>
          <SubscriptionStatusBadge type="workflow" lead={lead} />
        </div>
        <button
          type="button"
          onClick={onCopyPhone}
          className="sub-request-card__phone"
          dir="ltr"
        >
          {lead.whatsapp_number}
        </button>
      </div>
    </div>

    <div className="sub-request-card__meta">
      {lead.selected_plan_name && (
        <span className="sub-request-card__chip">
          <Package className="h-3 w-3" />
          {planLabelForLead(lead)}
        </span>
      )}
      {lead.governorate && (
        <span className="sub-request-card__chip sub-request-card__chip--muted">
          <MapPin className="h-3 w-3" />
          {lead.governorate}
        </span>
      )}
      <span className="sub-request-card__chip sub-request-card__chip--muted">
        <Calendar className="h-3 w-3" />
        {formatLeadRelativeTime(lead.created_at)}
      </span>
    </div>

    {lead.expected_monthly_orders && (
      <p className="sub-request-card__detail">
        الطلبات الشهرية: {getMonthlyOrderLabel(lead.expected_monthly_orders)}
      </p>
    )}

    <LeadCodeActionButton
      lead={lead}
      activeCode={activeCode}
      codes={codes}
      fullWidth
      onClick={onOpenCode}
    />

    <div className="sub-request-card__actions">
      <Button
        variant="outline"
        className="sub-request-card__action sub-request-card__action--whatsapp"
        onClick={onWhatsApp}
      >
        <MessageCircle className="h-4 w-4" />
        واتساب
      </Button>
      {lead.status === 'new' && onMarkContacted && (
        <Button variant="outline" className="sub-request-card__action" onClick={onMarkContacted}>
          <PhoneCall className="h-4 w-4" />
          تم التواصل
        </Button>
      )}
      <Link to={`/admin/leads/${lead.id}`} className={lead.status === 'new' ? '' : 'col-span-2'}>
        <Button variant="default" className="sub-request-card__action sub-request-card__action--primary w-full">
          <Eye className="h-4 w-4" />
          عرض التفاصيل
        </Button>
      </Link>
    </div>
  </article>
);

export default LeadRequestMobileCard;

export const LeadRequestDesktopMeta = ({ lead }: { lead: LeadRecord }) => (
  <div className="space-y-1">
    {lead.selected_plan_name ? (
      <Badge variant="outline" className="font-normal">
        {planLabelForLead(lead)}
      </Badge>
    ) : (
      <span className="text-muted-foreground text-sm">—</span>
    )}
    {lead.governorate && <p className="text-xs text-muted-foreground">{lead.governorate}</p>}
    <p className="text-[11px] text-muted-foreground lg:hidden">
      {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: ar })}
    </p>
  </div>
);

export const LeadRequestCopyButton = ({ onCopy }: { onCopy: () => void }) => (
  <Button size="sm" variant="ghost" className="rounded-lg h-9 px-2.5" onClick={onCopy}>
    <Copy className="w-4 h-4" />
  </Button>
);
