import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type PageSpinnerProps = {
  message?: string;
  className?: string;
  compact?: boolean;
};

const PageSpinner = memo(
  ({ message = 'جارٍ التحميل...', className, compact = false }: PageSpinnerProps) => (
    <div
      className={cn(
        'flex items-center justify-center bg-background font-arabic',
        compact ? 'py-16' : 'min-h-screen',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-9 w-9 animate-spin text-primary" strokeWidth={2} aria-hidden />
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </div>
  )
);

PageSpinner.displayName = 'PageSpinner';

export default PageSpinner;
