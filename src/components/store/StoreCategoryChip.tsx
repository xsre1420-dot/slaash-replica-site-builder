import { cn } from '@/lib/utils';

interface StoreCategoryChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

const StoreCategoryChip = ({
  label,
  active = false,
  onClick,
  className,
}: StoreCategoryChipProps) => {
  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative inline-flex items-center gap-2 rounded-full whitespace-nowrap text-xs font-semibold transition-all duration-200',
        active
          ? 'bg-primary text-primary-foreground px-4 py-2 shadow-md shadow-primary/20 ring-2 ring-primary/15 scale-[1.02]'
          : 'bg-card/90 text-muted-foreground hover:text-foreground border border-border/70 hover:border-primary/25 px-3.5 py-2 hover:bg-[hsl(var(--store-accent-muted))]',
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-2 w-2 shrink-0 rounded-full transition-all duration-200',
          active
            ? 'bg-primary-foreground shadow-[0_0_0_2px_hsl(var(--primary)/0.35)]'
            : 'bg-primary/70 group-hover:bg-primary group-hover:scale-110'
        )}
      />
      <span>{label}</span>
    </Tag>
  );
};

export default StoreCategoryChip;
