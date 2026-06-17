import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  attentionStripEmphasizedClass,
  attentionStripFadingClass,
  attentionStripIdleClass,
  attentionStripTransitionClass,
  type AttentionKey,
} from '@/lib/attentionHighlight';
import { useAttentionHighlight } from '@/hooks/useAttentionHighlight';

export type AttentionStripProps = {
  attentionKey: AttentionKey;
  message: string;
  visible?: boolean;
  icon?: LucideIcon;
  className?: string;
};

const AttentionStrip = ({
  attentionKey,
  message,
  visible = true,
  icon: Icon = AlertTriangle,
  className,
}: AttentionStripProps) => {
  const { phase, zoneRef } = useAttentionHighlight(attentionKey);

  if (!visible) return null;

  const isGlowing = phase === 'emphasized';
  const isFading = phase === 'fading';

  return (
    <div
      ref={zoneRef}
      role="status"
      aria-live="polite"
      dir="rtl"
      className={cn(
        'flex w-full items-center justify-start gap-2.5 border-b pb-4 text-right',
        attentionStripTransitionClass,
        isGlowing && attentionStripEmphasizedClass,
        isFading && attentionStripFadingClass,
        phase === 'idle' && attentionStripIdleClass,
        className
      )}
    >
      {isGlowing && (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/50 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
      )}
      <Icon
        className={cn(
          'w-4 h-4 shrink-0',
          isGlowing ? 'text-destructive' : 'text-destructive/90'
        )}
        aria-hidden
      />
      <p
        className={cn(
          'text-sm font-medium leading-snug min-w-0',
          isGlowing ? 'text-destructive' : 'text-foreground'
        )}
      >
        {message}
      </p>
    </div>
  );
};

export default AttentionStrip;
