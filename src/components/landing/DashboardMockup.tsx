import {
  BarChart3,
  Bell,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardMockupProps = {
  className?: string;
  variant?: 'desktop' | 'mobile';
};

const navItems = [
  { icon: LayoutDashboard, label: 'الرئيسية', active: true },
  { icon: Package, label: 'المنتجات', active: false },
  { icon: ShoppingBag, label: 'الطلبات', active: false },
  { icon: Users, label: 'العملاء', active: false },
  { icon: BarChart3, label: 'التقارير', active: false },
  { icon: Settings, label: 'الإعدادات', active: false },
];

const metrics = [
  {
    label: 'إجمالي المبيعات',
    value: '12,450,000',
    suffix: ' د.ع',
    delta: '+12%',
    icon: Wallet,
    spark: [18, 22, 20, 28, 24, 32, 30],
  },
  {
    label: 'الطلبات',
    value: '342',
    suffix: '',
    delta: '+8%',
    icon: ShoppingBag,
    spark: [24, 20, 28, 26, 34, 30, 38],
  },
  {
    label: 'العملاء',
    value: '218',
    suffix: '',
    delta: '+15%',
    icon: Users,
    spark: [12, 16, 14, 20, 18, 24, 22],
  },
  {
    label: 'المنتجات',
    value: '64',
    suffix: '',
    delta: '+5%',
    icon: Package,
    spark: [14, 16, 15, 18, 17, 20, 19],
  },
];

const recentOrders = [
  {
    id: '#1247',
    time: 'منذ 10 دقائق',
    amount: '45,000',
    status: 'تم التوصيل',
    tone: 'emerald' as const,
    thumbClass: 'lp-dashboard-order-thumb--headphones',
    thumb: '🎧',
  },
  {
    id: '#1248',
    time: 'منذ 25 دقيقة',
    amount: '128,500',
    status: 'تم الشحن',
    tone: 'sky' as const,
    thumbClass: 'lp-dashboard-order-thumb--watch',
    thumb: '⌚',
  },
  {
    id: '#1249',
    time: 'منذ 40 دقيقة',
    amount: '32,000',
    status: 'قيد المعالجة',
    tone: 'amber' as const,
    thumbClass: 'lp-dashboard-order-thumb--camera',
    thumb: '📷',
  },
];

const MiniLineChart = ({ points }: { points: number[] }) => {
  const width = 88;
  const height = 28;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * (height - 4) - 2;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-full" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={height - ((points[points.length - 1] - min) / range) * (height - 4) - 2}
        r="2.5"
        fill="hsl(var(--primary))"
      />
    </svg>
  );
};

const DashboardMockup = ({ className, variant = 'desktop' }: DashboardMockupProps) => (
  <div
    className={cn(
      'lp-dashboard-mockup',
      variant === 'mobile' && 'lp-dashboard-mockup--mobile',
      className
    )}
    dir="rtl"
  >
    <div className="lp-dashboard-shell">
      {variant === 'desktop' && (
        <aside className="lp-dashboard-sidebar">
          <div className="lp-dashboard-sidebar-brand">
            <span>بداية</span>
          </div>
          <nav className="lp-dashboard-nav">
            {navItems.map(({ icon: Icon, label, active }) => (
              <div key={label} className={cn('lp-dashboard-nav-item', active && 'lp-dashboard-nav-item--active')}>
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>{label}</span>
              </div>
            ))}
          </nav>
        </aside>
      )}

      <div className="lp-dashboard-main">
        {variant === 'mobile' && (
          <div className="lp-dashboard-mobile-brand">
            <span>بداية</span>
          </div>
        )}

        <div className="lp-dashboard-header">
          <div className="lp-dashboard-header-copy">
            <h3>مرحباً بك 👋</h3>
            <p>إليك نظرة سريعة على أداء متجرك اليوم</p>
          </div>
          <span className="lp-dashboard-notify" aria-hidden>
            <Bell className="h-4 w-4" strokeWidth={2} />
            <span className="lp-dashboard-notify-badge">2</span>
          </span>
        </div>

        <div className="lp-dashboard-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="lp-dashboard-metric">
              <div className="lp-dashboard-metric-top">
                <span className="lp-dashboard-metric-icon">
                  <metric.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <span className="lp-dashboard-metric-delta">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {metric.delta}
                </span>
              </div>
              <p className="lp-dashboard-metric-label">{metric.label}</p>
              <p className="lp-dashboard-metric-value">
                {metric.value}
                {metric.suffix && <span>{metric.suffix}</span>}
              </p>
              <MiniLineChart points={metric.spark} />
            </div>
          ))}
        </div>

        <div className="lp-dashboard-orders">
          <p className="lp-dashboard-orders-title">أحدث الطلبات</p>
          <div className="lp-dashboard-orders-list">
            {recentOrders.map((order) => (
              <div key={order.id} className="lp-dashboard-order-row">
                <div className="lp-dashboard-order-user">
                  <span className={cn('lp-dashboard-order-thumb', order.thumbClass)} aria-hidden>
                    {order.thumb}
                  </span>
                  <div className="lp-dashboard-order-copy">
                    <span className="lp-dashboard-order-id">{order.id}</span>
                    <span className="lp-dashboard-order-time">{order.time}</span>
                  </div>
                </div>
                <div className="lp-dashboard-order-meta">
                  <span className="lp-dashboard-order-amount">{order.amount} د.ع</span>
                  <span
                    className={cn(
                      'lp-dashboard-order-status',
                      order.tone === 'emerald' && 'lp-dashboard-order-status--emerald',
                      order.tone === 'sky' && 'lp-dashboard-order-status--sky',
                      order.tone === 'amber' && 'lp-dashboard-order-status--amber'
                    )}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default DashboardMockup;
