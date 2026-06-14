import { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ProductFormSectionProps {
  id?: string;
  icon: ReactNode;
  title: string;
  description?: string;
  optional?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

const ProductFormSection = ({
  id,
  icon,
  title,
  description,
  optional = false,
  defaultOpen = true,
  children,
}: ProductFormSectionProps) => {
  const body = (
    <div className="space-y-4">{children}</div>
  );

  if (!optional) {
    return (
      <section id={id} className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border/50 bg-muted/20">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">{icon}</div>
          <div className="text-right flex-1 min-w-0">
            <h2 className="font-bold text-foreground">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        <div className="p-5">{body}</div>
      </section>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} asChild>
      <section id={id} className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors group">
          <div className="p-2 rounded-xl bg-muted text-muted-foreground group-data-[state=open]:bg-primary/10 group-data-[state=open]:text-primary shrink-0">
            {icon}
          </div>
          <div className="text-right flex-1 min-w-0">
            <div className="flex items-center justify-end gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">اختياري</span>
              <h2 className="font-bold text-foreground">{title}</h2>
            </div>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-5">{body}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};

export default ProductFormSection;
