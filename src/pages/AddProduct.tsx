import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import CategoryDialog from '@/components/CategoryDialog';
import ProductFormEditor from '@/components/add-product/ProductFormEditor';
import ProductSaveActions from '@/components/add-product/ProductSaveActions';
import { useAddProductForm } from '@/hooks/useAddProductForm';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import AttentionStrip from '@/components/ui/AttentionStrip';
import { useMerchantProductsPage } from '@/hooks/useMerchantProductsPage';
import { useStore } from '@/context/StoreContext';
import { hasConfiguredDeliveryPrices } from '@/utils/deliveryUtils';
import { buildAttentionHref } from '@/lib/attentionHighlight';
import { Button } from '@/components/ui/button';
import { PackagePlus, Truck } from 'lucide-react';

const AddProduct = () => {
  const { state, actions } = useAddProductForm();
  const { storeSettings } = useStore();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const catalog = useMerchantProductsPage('', 'all');
  const catalogEmpty = !catalog.loading && catalog.total === 0;
  const deliveryConfigured = hasConfiguredDeliveryPrices(storeSettings.deliveryPrices);

  return (
    <DashboardLayout>
      <PageHeader
        title="إضافة منتج"
        description="4 حقول مطلوبة: صورة، اسم، فئة، سعر — الباقي يحسّن تجربة البيع"
        backTo="/products"
        backLabel="المنتجات"
        breadcrumbs={[{ label: 'المنتجات', href: '/products' }, { label: 'إضافة منتج' }]}
        actions={
          <ProductSaveActions
            isSubmitting={state.isSubmitting}
            pendingSaveMode={state.pendingSaveMode}
            isSaveDisabled={state.isSaveDisabled}
            onSaveDraft={actions.handleSaveDraft}
            onSaveAndPublish={actions.handleSaveAndPublish}
            className="justify-end"
          />
        }
      />

      <div className="ds-page max-w-6xl pb-28 lg:pb-8 space-y-6">
        {!deliveryConfigured && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-4 space-y-3">
            <AttentionStrip
              attentionKey="missing-delivery-prices"
              icon={Truck}
              message="يجب إعداد أسعار التوصيل قبل إضافة المنتجات — بدونها لا يمكن إكمال الطلبات في المتجر"
              className="border-none pb-0"
            />
            <div className="flex justify-end">
              <Button asChild variant="default" size="sm" className="rounded-xl">
                <Link to={buildAttentionHref('/settings', 'missing-delivery-prices')}>
                  إعداد أسعار التوصيل
                </Link>
              </Button>
            </div>
          </div>
        )}

        <AttentionStrip
          attentionKey="empty-catalog"
          visible={catalogEmpty && deliveryConfigured}
          icon={PackagePlus}
          message="متجرك بدون منتجات — أضف منتجاً واحداً على الأقل لبدء البيع"
        />

        <div className={!deliveryConfigured ? 'pointer-events-none opacity-50 select-none' : undefined}>
          <ProductFormEditor
            formId="add-product-form"
            state={state}
            actions={actions}
            onOpenCategoryDialog={() => setIsCategoryDialogOpen(true)}
            mode="create"
          />
        </div>

        <div className="fixed bottom-0 inset-x-0 p-3 bg-card border-t border-border lg:hidden z-40 safe-area-bottom">
          <ProductSaveActions
            isSubmitting={state.isSubmitting}
            pendingSaveMode={state.pendingSaveMode}
            isSaveDisabled={state.isSaveDisabled}
            onSaveDraft={actions.handleSaveDraft}
            onSaveAndPublish={actions.handleSaveAndPublish}
            size="sticky"
          />
        </div>
      </div>

      <CategoryDialog
        categories={state.categories}
        onCategoryChange={actions.loadCategories}
        onAddLocalCategory={() => void actions.loadCategories()}
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
      />
    </DashboardLayout>
  );
};

export default AddProduct;
