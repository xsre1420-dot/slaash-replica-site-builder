import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type RtlHeaderBarProps = {
  title: React.ReactNode;
  className?: string;
  titleClassName?: string;
  backTo?: string;
  onBack?: () => void;
  backLabel?: string;
  startSlot?: React.ReactNode;
  endSlot?: React.ReactNode;
  balanceWidth?: string;
  hideBack?: boolean;
};

export function RtlHeaderBar({
  title,
  className,
  titleClassName,
  backTo,
  onBack,
  backLabel = 'رجوع',
  startSlot,
  endSlot,
  balanceWidth = 'w-10',
  hideBack = false,
}: RtlHeaderBarProps) {
  const backClassName = 'icon-circle-btn';

  const backControl = hideBack ? (
    <div className={cn(balanceWidth, 'shrink-0')} aria-hidden />
  ) : (
    startSlot ??
    (backTo ? (
      <Link to={backTo} aria-label={backLabel} className={backClassName}>
        <ArrowRight className="w-5 h-5 text-primary" strokeWidth={2.25} />
      </Link>
    ) : onBack ? (
      <button type="button" onClick={onBack} aria-label={backLabel} className={backClassName}>
        <ArrowRight className="w-5 h-5 text-primary" strokeWidth={2.25} />
      </button>
    ) : (
      <div className={cn(balanceWidth, 'shrink-0')} aria-hidden />
    ))
  );

  return (
    <div dir="rtl" className={cn('flex items-center justify-between gap-3', className)}>
      {backControl}
      <div className={cn('flex-1 min-w-0 text-center font-bold text-foreground truncate', titleClassName)}>
        {title}
      </div>
      {endSlot ?? <div className={cn(balanceWidth, 'shrink-0')} aria-hidden />}
    </div>
  );
}
