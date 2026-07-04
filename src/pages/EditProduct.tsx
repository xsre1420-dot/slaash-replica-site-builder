import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import CategoryDialog from '@/components/CategoryDialog';
import ProductFormEditor from '@/components/add-product/ProductFormEditor';
import ProductSaveActions from '@/components/add-product/ProductSaveActions';
import ProductEditorHeaderActions from '@/components/add-product/ProductEditorHeaderActions';
import { useEditProductForm } from '@/hooks/useEditProductForm';
import { deleteProduct } from '@/services/productService';
import { useUndoDelete } from '@/hooks/useUndoDelete';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

const EditProductSkeleton = () => (
  <div className="ds-page max-w-6xl pb-28 lg:pb-8">
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  </div>
);

const EditProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  const { state, actions } = useEditProductForm(productId);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { deleteWithUndo } = useUndoDelete();

  const handleDeleteProduct = async () => {
    if (!productId || !state.loadedProduct) return;
    setDeleteDialogOpen(false);
    const product = state.loadedProduct;
    navigate('/products');

    deleteWithUndo({
      item: product,
      itemName: product.name,
      onDelete: async () => deleteProduct(productId),
      onRestore: () => {
        toast({ title: 'تم الاستعادة', description: 'تم استعادة المنتج بنجاح' });
        navigate(`/edit-product/${productId}`);
      },
      timeoutMs: 5000,
    });
  };

  if (state.loading) {
    return (
      <DashboardLayout>
        <PageHeader
          title="تعديل المنتج"
          description="جاري تحميل بيانات المنتج..."
          backTo="/products"
          breadcrumbs={[{ label: 'المنتجات', href: '/products' }, { label: 'تعديل' }]}
        />
        <EditProductSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="تعديل المنتج"
        description={state.name || 'تحديث بيانات المنتج'}
        backTo="/products"
        backLabel="المنتجات"
        breadcrumbs={[{ label: 'المنتجات', href: '/products' }, { label: state.name || 'تعديل' }]}
        actions={
          <ProductEditorHeaderActions
            isSubmitting={state.isSubmitting}
            pendingSaveMode={state.pendingSaveMode}
            isSaveDisabled={state.isSaveDisabled}
            onSaveDraft={actions.handleSaveDraft}
            onSaveAndPublish={actions.handleSaveAndPublish}
            onDelete={() => setDeleteDialogOpen(true)}
          />
        }
      />

      <div className="ds-page max-w-6xl pb-28 lg:pb-8">
        <ProductFormEditor
          formId="edit-product-form"
          state={state}
          actions={actions}
          onOpenCategoryDialog={() => setIsCategoryDialogOpen(true)}
          mode="edit"
        />

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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف هذا المنتج؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف «{state.name}». يمكنك التراجع خلال 5 ثوانٍ بعد الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive hover:bg-destructive/90">
              نعم، احذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default EditProduct;
