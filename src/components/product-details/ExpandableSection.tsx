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
  }, [isOpen, children]);

  return (
    <div className={cn('sf-pdp-expand', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="sf-pdp-expand-trigger"
        aria-expanded={isOpen}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
        <div className="flex items-center gap-2.5 min-w-0">
          {icon}
          <h3 className="text-base font-bold text-foreground">{title}</h3>
        </div>
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-[height] duration-250 ease-out"
        style={{ height: height !== undefined ? `${height}px` : 'auto' }}
      >
        <div className="pb-5 pt-1 text-right">{children}</div>
      </div>
    </div>
  );
};

export default ExpandableSection;
