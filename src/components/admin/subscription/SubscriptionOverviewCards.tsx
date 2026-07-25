import {
  Users,
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SubscriptionOverviewStats = {
  total: number;
  active: number;
  expired: number;
  suspended: number;
};

type StatCard = {
  key: keyof SubscriptionOverviewStats | 'new' | 'pending';
  label: string;
  icon: LucideIcon;
  accentBg: string;
  accentText: string;
  filterValue?: string;
};

const STAT_CARDS: StatCard[] = [
  {
    key: 'total',
    label: 'إجمالي الاشتراكات',
    icon: Users,
    accentBg: 'bg-primary/10',
    accentText: 'text-primary',
  },
  {
    key: 'active',
    label: 'نشطة',
    icon: CheckCircle2,
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-600',
    filterValue: 'active',
  },
  {
    key: 'expired',
    label: 'منتهية',
    icon: Clock,
    accentBg: 'bg-slate-500/10',
    accentText: 'text-slate-600',
    filterValue: 'expired',
  },
  {
    key: 'suspended',
    label: 'موقوفة',
    icon: XCircle,
    accentBg: 'bg-amber-500/10',
    accentText: 'text-amber-700',
    filterValue: 'suspended',
  },
];

type SubscriptionOverviewCardsProps = {
  stats: SubscriptionOverviewStats;
  activeStatus?: string;
  onStatusFilter?: (status: string) => void;
  loading?: boolean;
};

const SubscriptionOverviewCards = ({
  stats,
  activeStatus = 'all',
  onStatusFilter,
  loading,
}: SubscriptionOverviewCardsProps) => (
  <div className="sub-admin-stats">
    {STAT_CARDS.map(({ key, label, icon: Icon, accentBg, accentText, filterValue }) => {
      const value = stats[key as keyof SubscriptionOverviewStats] ?? 0;
      const isActive = filterValue ? activeStatus === filterValue : activeStatus === 'all';
      const clickable = Boolean(filterValue && onStatusFilter);

      return (
        <button
          key={key}
          type="button"
          disabled={loading || !clickable}
          onClick={() => filterValue && onStatusFilter?.(filterValue)}
          className={cn(
            'sub-admin-stat-card',
            clickable && 'sub-admin-stat-card--clickable',
            isActive && filterValue && 'sub-admin-stat-card--active'
          )}
        >
          <span className={cn('sub-admin-stat-card__icon', accentBg)}>
            <Icon className={cn('h-4 w-4', accentText)} strokeWidth={1.75} />
          </span>
          <div className="sub-admin-stat-card__body">
            <p className="sub-admin-stat-card__value">{loading ? '—' : value}</p>
            <p className="sub-admin-stat-card__label">{label}</p>
          </div>
        </button>
      );
    })}
  </div>
);

export default SubscriptionOverviewCards;

export type LeadOverviewStats = {
  total: number;
  new_count: number;
  unread_count: number;
  customer_count: number;
  pipeline_count: number;
};

type LeadOverviewCardsProps = {
  stats: LeadOverviewStats | null;
  loading?: boolean;
};

export const LeadOverviewCards = ({ stats, loading }: LeadOverviewCardsProps) => {
  const cards = [
    { label: 'إجمالي الطلبات', value: stats?.total ?? 0, icon: Users, bg: 'bg-primary/10', text: 'text-primary' },
    { label: 'طلبات جديدة', value: stats?.new_count ?? 0, icon: Inbox, bg: 'bg-blue-500/10', text: 'text-blue-600' },
    { label: 'قيد المتابعة', value: stats?.pipeline_count ?? 0, icon: Clock, bg: 'bg-violet-500/10', text: 'text-violet-600' },
    { label: 'مُفعّلون', value: stats?.customer_count ?? 0, icon: CheckCircle2, bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  ];

  return (
    <div className="sub-admin-stats sub-admin-stats--4">
      {cards.map(({ label, value, icon: Icon, bg, text }) => (
        <div key={label} className="sub-admin-stat-card sub-admin-stat-card--static">
          <span className={cn('sub-admin-stat-card__icon', bg)}>
            <Icon className={cn('h-4 w-4', text)} strokeWidth={1.75} />
          </span>
          <div className="sub-admin-stat-card__body">
            <p className="sub-admin-stat-card__value">{loading ? '—' : value}</p>
            <p className="sub-admin-stat-card__label">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
