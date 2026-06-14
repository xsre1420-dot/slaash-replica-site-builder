import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Package,
  ShoppingBag,
  Clock,
  TrendingUp,
  Plus,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import StatCard from '@/components/ui/StatCard';
import { useOrders } from '@/hooks/useOrders';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { getProductsSync } from '@/services/productService';
import { cn } from '@/lib/utils';

const statusConfig = {
  completed: { label: 'مكتمل', icon: CheckCircle, className: 'bg-success/10 text-success' },
  pending: { label: 'قيد الانتظار', icon: Clock, className: 'bg-warning/10 text-warning' },
  cancelled: { label: 'ملغي', icon: XCircle, className: 'bg-destructive/10 text-destructive' },
};

const DashboardOverview = () => {
  const { orders, loading, refetch } = useOrders();
  useRealtimeOrders(refetch);

  const productCount = getProductsSync().length;
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;
  const revenue = orders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.total, 0);
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Action alerts */}
      {productCount === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-warning/20 bg-warning/5">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">متجرك فارغ — أضف أول منتج</p>
              <p className="text-xs text-muted-foreground mt-0.5">لا يمكن للعملاء الشراء بدون منتجات. ابدأ بإضافة منتج واحد على الأقل.</p>
            </div>
          </div>
          <Link to="/add-product" className="shrink-0">
            <Button size="sm" className="rounded-xl w-full sm:w-auto min-h-[44px]">
              <Plus className="w-4 h-4" />
              إضافة منتج
            </Button>
          </Link>
        </div>
      )}

      {pendingCount > 0 && (
        <Link to="/orders" className="block group">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {pendingCount} {pendingCount === 1 ? 'طلب ينتظر' : 'طلبات تنتظر'} معالجتك
              </p>
              <p className="text-xs text-muted-foreground">اضغط لعرض الطلبات وتحديث حالتها</p>
            </div>
            <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </div>
        </Link>
      )}

      {/* KPI stats */}
      <div>
        <h3 className="ds-section-title mb-4 px-1">ملخص المتجر</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="الطلبات" value={orders.length} icon={ShoppingBag} />
          <StatCard
            label="قيد الانتظار"
            value={pendingCount}
            icon={Clock}
            iconClassName="bg-warning/10 [&_svg]:text-warning"
          />
          <StatCard label="المنتجات" value={productCount} icon={Package} />
          <StatCard label="الإيرادات (د.ع)" value={revenue.toLocaleString()} icon={TrendingUp} />
        </div>
        {orders.length > 0 && completedCount === 0 && pendingCount === 0 && (
          <p className="text-xs text-muted-foreground mt-2 px-1">الإحصائيات تعكس الطلبات المحمّلة حالياً</p>
        )}
      </div>

      {/* Recent orders */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="ds-section-title">آخر الطلبات</h3>
          {orders.length > 0 && (
            <Link to="/orders" className="text-xs text-primary hover:text-primary/80 font-medium">
              عرض الكل
            </Link>
          )}
        </div>

        {recentOrders.length > 0 ? (
          <div className="ds-card divide-y divide-border/40 overflow-hidden">
            {recentOrders.map((order) => {
              const config =
                statusConfig[order.status as keyof typeof statusConfig] ?? statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-medium text-foreground truncate">{order.customerInfo.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(order.date), 'yyyy-MM-dd · hh:mm a')}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-foreground tabular-nums shrink-0">
                    {order.total.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">د.ع</span>
                  </p>
                  <Badge className={cn('border-0 shrink-0', config.className)}>
                    <StatusIcon className="w-3 h-3 ml-1" />
                    {config.label}
                  </Badge>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="ds-card p-6 text-center">
            <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد طلبات بعد — شارك رابط متجرك مع عملائك</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
