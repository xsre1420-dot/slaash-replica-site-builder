import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const ExpandableSection = ({
  title,
  children,
  defaultOpen = false,
  icon,
  className,
}: ExpandableSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div className={cn('sf-card overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-right hover:bg-muted/20 transition-colors"
      >
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
        />
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <h3 className="text-base font-bold text-foreground">{title}</h3>
        </div>
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: height !== undefined ? `${height}px` : 'auto' }}
      >
        <div className="px-6 pb-6 pt-0 text-right border-t border-border/20">{children}</div>
      </div>
    </div>
  );
};

export default ExpandableSection;
