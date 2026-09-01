import { Suspense, lazy } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, MessageSquare } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useProductReviewsPageBundle } from '@/hooks/useProductReviewsPageBundle';

const ProductReviewsManager = lazy(
  () => import('@/components/product-management/ProductReviewsManager')
);

const ProductReviewsPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const location = useLocation();
  const page = useProductReviewsPageBundle(productId);

  const fallbackName =
    (location.state as { productName?: string } | null)?.productName?.trim() || 'المنتج';
  const productName = page.productName || fallbackName;

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
        title="إدارة التعليقات"
        description={productName}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/builder' },
          { label: 'المنتجات', href: '/products' },
          { label: 'التعليقات' },
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
          <MessageSquare className="w-4 h-4 text-primary shrink-0" />
          <span>مراجعة وموافقة تعليقات العملاء على «{productName}»</span>
        </div>

        <Suspense
          fallback={<div className="py-12 text-center text-muted-foreground">جاري التحميل...</div>}
        >
          <ProductReviewsManager
            productId={productId}
            productName={productName}
            reviews={page.reviews}
            loading={page.loading}
            onReviewsChange={page.setReviews}
          />
        </Suspense>
      </div>
    </DashboardLayout>
  );
};

export default ProductReviewsPage;
