import { BarChart3, LayoutDashboard, Package, ShoppingBag, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardMockupProps = {
  className?: string;
  compact?: boolean;
};

const DashboardMockup = ({ className, compact = false }: DashboardMockupProps) => (
  <div
    className={cn(
      'overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.12)]',
      className
    )}
    dir="ltr"
  >
    <div className="flex border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#fca5a5]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#fcd34d]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#86efac]" />
      </div>
      <div className="mx-auto hidden h-6 w-48 rounded-md bg-white/80 sm:block" />
    </div>

    <div className="flex">
      <aside className={cn('hidden shrink-0 border-r border-[#e2e8f0] bg-white sm:block', compact ? 'w-14' : 'w-44')}>
        <div className="space-y-1 p-3">
          {[
            { icon: LayoutDashboard, active: true },
            { icon: Package, active: false },
            { icon: ShoppingBag, active: false },
            { icon: BarChart3, active: false },
          ].map(({ icon: Icon, active }, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium',
                active ? 'bg-primary/10 text-primary' : 'text-[#94a3b8]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {!compact && <span>{['Dashboard', 'Products', 'Orders', 'Analytics'][i]}</span>}
            </div>
          ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-[#f8fafc] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Overview</p>
            <p className="text-sm font-semibold text-[#111827]">Store performance</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
            <TrendingUp className="h-3 w-3" />
            +24%
          </span>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Revenue', value: '4.2M د.ع', tone: 'text-[#111827]' },
            { label: 'Orders', value: '1,284', tone: 'text-primary' },
            { label: 'Visitors', value: '18.5K', tone: 'text-[#111827]' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-[#e2e8f0] bg-white p-2.5 sm:p-3">
              <p className="text-[9px] font-medium text-[#94a3b8] sm:text-[10px]">{stat.label}</p>
              <p className={cn('mt-1 text-sm font-bold tabular-nums sm:text-base', stat.tone)}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 sm:p-4">
          <div className="mb-3 flex items-end justify-between gap-2">
            <p className="text-xs font-semibold text-[#111827]">Weekly sales</p>
            <p className="text-[10px] text-[#94a3b8]">Last 7 days</p>
          </div>
          <div className="flex h-24 items-end gap-1.5 sm:h-28 sm:gap-2">
            {[38, 52, 44, 68, 58, 82, 74].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col justify-end gap-1">
                <div
                  className={cn('w-full rounded-md', i === 5 ? 'bg-primary' : 'bg-primary/20')}
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default DashboardMockup;
