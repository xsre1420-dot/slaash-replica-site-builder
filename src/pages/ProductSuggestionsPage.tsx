import { Suspense, lazy } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, Lightbulb } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

const SuggestedProductsManager = lazy(
  () => import('@/components/product-management/SuggestedProductsManager')
);

const ProductSuggestionsPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const location = useLocation();
  const productName =
    (location.state as { productName?: string } | null)?.productName?.trim() || 'المنتج';

  if (!productId) {
    return (
      <DashboardLayout>
        <div className="ds-page max-w-4xl text-center py-16 text-muted-foreground">
          معرّف المنتج غير صالح
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="منتجات تحت هذا المنتج"
        description={productName}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/builder' },
          { label: 'المنتجات', href: '/products' },
          { label: 'منتجات تحته' },
        ]}
        actions={
          <Button variant="outline" size="sm" className="rounded-xl gap-2" asChild>
            <Link to="/products">
              <ArrowRight className="w-4 h-4" />
              العودة للمنتجات
            </Link>
          </Button>
        }
      />

      <div className="ds-page max-w-4xl min-w-0 pb-24 sm:pb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Lightbulb className="w-4 h-4 text-primary shrink-0" />
          <span>حدّد المنتجات التي تظهر أسفل «{productName}» في صفحة المنتج</span>
        </div>

        <Suspense
          fallback={<div className="py-12 text-center text-muted-foreground">جاري التحميل...</div>}
        >
          <SuggestedProductsManager productId={productId} productName={productName} />
        </Suspense>
      </div>
    </DashboardLayout>
  );
};

export default ProductSuggestionsPage;
