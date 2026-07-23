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
        'sf-pill text-sm transition-transform duration-150 active:scale-[0.97]',
        active ? 'sf-pill-active' : 'sf-pill-inactive',
        className
      )}
    >
      {label}
    </Tag>
  );
};

export default StoreCategoryChip;
