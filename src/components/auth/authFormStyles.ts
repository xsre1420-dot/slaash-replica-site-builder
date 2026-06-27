/** Shared auth form tokens — clean SaaS styling, no text glow/shadows */

export const authLabelClass =
  'block text-right text-sm font-medium text-foreground mb-1.5';

export const authHintClass =
  'text-xs text-muted-foreground mt-1.5 text-right';

export const authInputClass =
  'h-11 w-full rounded-lg border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/55 transition-colors hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50';

export const authInputWithIconClass = `${authInputClass} pl-10`;

export const authPasswordInputClass = `${authInputClass} pl-11 pr-3.5`;

export const authSubmitClass =
  'w-full h-11 rounded-lg text-sm font-semibold';

export const authSecondaryButtonClass =
  'h-11 rounded-lg text-sm font-medium';

export const authPageTitleClass =
  'text-2xl sm:text-[1.625rem] font-semibold tracking-tight text-foreground';

export const authPageSubtitleClass =
  'text-sm text-muted-foreground mt-1.5';

export const authToggleButtonClass =
  'absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20';
