import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import ProductSaveActions from '@/components/add-product/ProductSaveActions';
import type { ProductSaveMode } from '@/lib/productFormLabels';
import { cn } from '@/lib/utils';

interface ProductEditorHeaderActionsProps {
  isSubmitting: boolean;
  pendingSaveMode: ProductSaveMode | null;
  isSaveDisabled: boolean;
  onSaveDraft: () => void;
  onSaveAndPublish: () => void;
  onDelete?: () => void;
  className?: string;
}

const ProductEditorHeaderActions = ({
  isSubmitting,
  pendingSaveMode,
  isSaveDisabled,
  onSaveDraft,
  onSaveAndPublish,
  onDelete,
  className,
}: ProductEditorHeaderActionsProps) => (
  <div className={cn('flex items-center gap-2', className)}>
    <ProductSaveActions
      isSubmitting={isSubmitting}
      pendingSaveMode={pendingSaveMode}
      isSaveDisabled={isSaveDisabled}
      onSaveDraft={onSaveDraft}
      onSaveAndPublish={onSaveAndPublish}
      className="justify-end"
    />
    {onDelete && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="rounded-xl shrink-0" aria-label="إجراءات إضافية">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl min-w-[180px]">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4 ml-2" />
            حذف المنتج
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            المعاينة والنسخ — قريباً
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )}
  </div>
);

export default ProductEditorHeaderActions;
