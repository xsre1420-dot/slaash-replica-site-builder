import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type LandingSectionHeaderProps = {
  icon?: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  align?: 'center' | 'right';
  className?: string;
};

const LandingSectionHeader = ({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className,
}: LandingSectionHeaderProps) => (
  <div
    className={cn(
      align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl text-right',
      className
    )}
  >
    <span className="lp-badge">
      {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
      {eyebrow}
    </span>
    <h2 className="lp-section-title">{title}</h2>
    {subtitle && <p className="lp-section-subtitle">{subtitle}</p>}
  </div>
);

export default LandingSectionHeader;
