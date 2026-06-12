import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  backTo?: string | false;
  backLabel?: string;
  hideBack?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader = ({
  title,
  description,
  backTo = '/builder',
  backLabel,
  hideBack = false,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) => (
  <header className={cn('border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-30', className)}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="مسار التنقل" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronLeft className="w-3 h-3 rotate-180 opacity-50" />}
              {crumb.href ? (
                <Link to={crumb.href} className="hover:text-primary transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {!hideBack && backTo !== false && (
            <Link to={backTo || '/builder'} aria-label={backLabel || 'رجوع'}>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl hover:bg-primary/5 hover:text-primary min-h-[44px] min-w-[44px]"
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  </header>
);

export default PageHeader;
