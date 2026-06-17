export const ATTENTION_PARAM = 'attention';

/** How long the strip glow stays before fading */
export const ATTENTION_EMPHASIS_MS = 4000;

/** Fade-out duration after emphasis */
export const ATTENTION_FADE_MS = 1600;

export type AttentionKey =
  | 'pending-orders'
  | 'pending-reviews'
  | 'low-stock'
  | 'empty-catalog'
  | 'missing-slug'
  | 'draft-products';

export type AttentionVisualPhase = 'idle' | 'emphasized' | 'fading';

export const buildAttentionHref = (path: string, key: AttentionKey): string => {
  const [base, existingQuery] = path.split('?');
  const params = new URLSearchParams(existingQuery ?? '');
  params.set(ATTENTION_PARAM, key);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
};

/** Dashboard action cards */
export const attentionAlertItemClass =
  'rounded-2xl border border-border/50 bg-card shadow-sm ' +
  'hover:border-primary/20 hover:bg-accent/30 hover:shadow-md hover:shadow-black/[0.03] ' +
  'transition-all duration-200';

export const attentionAlertIconClass =
  'bg-muted/80 text-foreground/70 group-hover:bg-primary/10 group-hover:text-primary transition-colors';

/** Strip — idle (persistent alert) */
export const attentionStripIdleClass = 'border-border/60';

/** Strip — initial glow when arriving from dashboard */
export const attentionStripEmphasizedClass =
  'border-destructive/60 bg-destructive/[0.04] ' +
  'shadow-[0_6px_22px_-10px_hsl(var(--destructive)/0.38)] animate-attention-strip-glow';

/** Strip — settling back to normal */
export const attentionStripFadingClass =
  'border-border/60 bg-transparent shadow-none';

export const attentionStripTransitionClass =
  'transition-[border-color,background-color,box-shadow,color] duration-[1600ms] ease-out';
