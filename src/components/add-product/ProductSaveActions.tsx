import { Button } from '@/components/ui/button';
import { Loader2, Save, Eye } from 'lucide-react';
import { PRODUCT_SAVE_LABELS, type ProductSaveMode } from '@/lib/productFormLabels';
import { cn } from '@/lib/utils';

interface ProductSaveActionsProps {
  isSubmitting: boolean;
  pendingSaveMode: ProductSaveMode | null;
  isSaveDisabled: boolean;
  onSaveDraft: () => void;
  onSaveAndPublish: () => void;
  className?: string;
  size?: 'default' | 'sticky';
}

const ProductSaveActions = ({
  isSubmitting,
  pendingSaveMode,
  isSaveDisabled,
  onSaveDraft,
  onSaveAndPublish,
  className,
  size = 'default',
}: ProductSaveActionsProps) => {
  const draftLoading = isSubmitting && pendingSaveMode === 'draft';
  const publishLoading = isSubmitting && pendingSaveMode === 'publish';
  const sticky = size === 'sticky';

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        disabled={isSaveDisabled}
        onClick={onSaveDraft}
        className={cn('rounded-xl gap-1.5', sticky ? 'flex-1 h-12 font-semibold' : 'min-h-[44px]')}
        aria-busy={draftLoading}
      >
        {draftLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="w-4 h-4" aria-hidden="true" />
        )}
        {draftLoading ? PRODUCT_SAVE_LABELS.saving : PRODUCT_SAVE_LABELS.saveDraft}
      </Button>
      <Button
        type="button"
        disabled={isSaveDisabled}
        onClick={onSaveAndPublish}
        className={cn('rounded-xl gap-1.5', sticky ? 'flex-1 h-12 font-semibold' : 'min-h-[44px]')}
        aria-busy={publishLoading}
      >
        {publishLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Eye className="w-4 h-4" aria-hidden="true" />
        )}
        {publishLoading ? PRODUCT_SAVE_LABELS.saving : PRODUCT_SAVE_LABELS.saveAndPublish}
      </Button>
    </div>
  );
};

export default ProductSaveActions;
