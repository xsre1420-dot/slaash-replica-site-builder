import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AccessCodeRecord } from '@/types/accessCodes';
import type { LeadRecord } from '@/types/leads';
import {
  canCreateAccessCodeForLead,
  canIssueNewLoginCodeForConvertedLead,
  canManageAccessCodeForLead,
  canReissueAccessCodeForLead,
  getRawActiveAccessCode,
  getUsableActiveAccessCode,
  isConvertedLead,
} from '@/utils/leadAccessCodeUtils';
import { getStoredAccessCodeForLead } from '@/utils/accessCodeSessionStore';
import { cn } from '@/lib/utils';

type LeadCodeActionButtonProps = {
  lead: LeadRecord;
  activeCode?: AccessCodeRecord | null;
  codes?: AccessCodeRecord[];
  onClick: () => void;
  fullWidth?: boolean;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
};

export const LeadCodeActionButton = ({
  lead,
  activeCode = null,
  codes = [],
  onClick,
  fullWidth = false,
  size = 'sm',
  className,
}: LeadCodeActionButtonProps) => {
  const converted = isConvertedLead(lead);
  const canManage = canManageAccessCodeForLead(lead, codes);
  const canReissue = canReissueAccessCodeForLead(lead, codes);
  const rawActive = getRawActiveAccessCode(codes);
  const usableActive = getUsableActiveAccessCode(codes);

  if (converted && !canIssueNewLoginCodeForConvertedLead(lead, codes)) {
    return (
      <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
        اشتراك منتهٍ
      </Badge>
    );
  }

  if (canManage) {
    const needsNewCode =
      canReissue ||
      (converted && canIssueNewLoginCodeForConvertedLead(lead, codes)) ||
      (usableActive != null && !getStoredAccessCodeForLead(lead.id, usableActive.id)) ||
      (lead.has_pending_code && !usableActive && !rawActive);

    return (
      <Button
        size={fullWidth ? 'default' : size}
        variant={needsNewCode || !usableActive ? 'default' : 'outline'}
        className={cn(
          fullWidth ? 'w-full rounded-xl gap-2' : 'rounded-lg h-9 gap-1.5 text-xs sm:text-sm px-3',
          (needsNewCode || !usableActive) && 'bg-amber-600 hover:bg-amber-700 text-white',
          className
        )}
        onClick={onClick}
      >
        <KeyRound className="w-4 h-4" />
        {!usableActive && !converted
          ? fullWidth
            ? 'إنشاء رمز دخول'
            : 'إنشاء رمز'
          : needsNewCode
            ? 'إنشاء رمز جديد للعميل'
            : 'إدارة الرمز'}
      </Button>
    );
  }

  if (canCreateAccessCodeForLead(lead, codes)) {
    return (
      <Button
        size={fullWidth ? 'default' : size}
        className={cn(
          fullWidth ? 'w-full rounded-xl gap-2' : 'rounded-lg h-9 gap-1.5 text-xs sm:text-sm px-3',
          className
        )}
        onClick={onClick}
      >
        <KeyRound className="w-4 h-4" />
        {fullWidth ? 'إنشاء رمز دخول' : 'إنشاء رمز'}
      </Button>
    );
  }

  return null;
};

export default LeadCodeActionButton;
