import {
  Inbox,
  KeyRound,
  Clock,
  Sparkles,
  CheckCircle2,
  ListFilter,
  GitBranch,
  X,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LEAD_FILTER_DEFINITIONS,
  type LeadQuickFilter,
  type LeadFilterStats,
} from '@/utils/leadWorkflowUtils';

export type LeadStats = LeadFilterStats;

type LeadStatsBarProps = {
  stats: LeadStats | null;
  activeFilter: LeadQuickFilter;
  onFilter: (filter: LeadQuickFilter) => void;
  loading?: boolean;
  resultCount?: number;
};

const ICONS: Record<string, LucideIcon> = {
  all: ListFilter,
  unread: Inbox,
  needs_code: KeyRound,
  pending_activation: Clock,
  pipeline: GitBranch,
  today: Sparkles,
  customers: CheckCircle2,
};

const LeadStatsBar = ({
  stats,
  activeFilter,
  onFilter,
  loading,
  resultCount,
}: LeadStatsBarProps) => {
  const activeDef = LEAD_FILTER_DEFINITIONS.find((d) => d.id === activeFilter);
  const workflowFilters = LEAD_FILTER_DEFINITIONS.filter((d) => d.group === 'workflow');
  const overviewFilters = LEAD_FILTER_DEFINITIONS.filter((d) => d.group === 'overview');

  const handleFilterClick = (id: LeadQuickFilter) => {
    onFilter(activeFilter === id && id !== 'all' ? 'all' : id);
  };

  return (
    <div className="space-y-3">
      {/* Overview strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-gradient-to-bl from-[#6366f1]/[0.04] via-card to-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">إجمالي الطلبات</p>
            <p className="text-2xl font-bold tabular-nums leading-none">
              {loading ? '—' : (stats?.total ?? 0)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {overviewFilters.map(({ id, label, statKey, accentBg, accentText }) => {
            const value = stats?.[statKey] ?? 0;
            const isActive = activeFilter === id;
            const Icon = ICONS[id] ?? Sparkles;
            return (
              <button
                key={id}
                type="button"
                disabled={loading}
                onClick={() => handleFilterClick(id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-right transition-all min-h-[44px]',
                  isActive
                    ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20'
                    : 'border-border/50 bg-background/80 hover:border-primary/25 hover:bg-muted/40'
                )}
              >
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', accentBg)}>
                  <Icon className={cn('h-3.5 w-3.5', accentText)} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-bold tabular-nums">{loading ? '—' : value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workflow filters */}
      <div className="rounded-2xl border border-border/50 bg-card p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground">مسار المتابعة</p>
          <button
            type="button"
            onClick={() => handleFilterClick('all')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-all',
              activeFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            الكل
            {!loading && stats && (
              <span className="mr-1.5 tabular-nums opacity-80">({stats.total})</span>
            )}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {workflowFilters.map(({ id, label, statKey, accentBg, accentText, description }, index) => {
            const value = stats?.[statKey] ?? 0;
            const isActive = activeFilter === id;
            const Icon = ICONS[id] ?? ListFilter;
            const hasUrgent = id === 'unread' && value > 0;

            return (
              <div key={id} className="flex items-center gap-2 shrink-0">
                {index > 0 && (
                  <span className="hidden sm:block text-muted-foreground/40 text-lg select-none">←</span>
                )}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleFilterClick(id)}
                  title={description}
                  className={cn(
                    'relative flex min-w-[120px] flex-col rounded-xl border p-3 text-right transition-all',
                    isActive
                      ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/15 shadow-sm'
                      : 'border-border/60 bg-background hover:border-primary/30 hover:bg-muted/30',
                    hasUrgent && !isActive && 'border-blue-400/40 bg-blue-500/[0.03]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', accentBg)}>
                      <Icon className={cn('h-3.5 w-3.5', accentText)} strokeWidth={1.75} />
                    </span>
                    <span
                      className={cn(
                        'text-lg font-bold tabular-nums',
                        hasUrgent && 'text-blue-600',
                        value === 0 && 'text-muted-foreground/60'
                      )}
                    >
                      {loading ? '—' : value}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
                  {hasUrgent && (
                    <span className="absolute -top-1 -left-1 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active filter banner */}
      {activeFilter !== 'all' && activeDef && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5">
          <div className="text-right min-w-0">
            <p className="text-xs text-muted-foreground">العرض الحالي</p>
            <p className="text-sm font-medium text-foreground">
              {activeDef.label}
              {resultCount !== undefined && (
                <span className="mr-1.5 text-muted-foreground font-normal tabular-nums">
                  — {resultCount} طلب
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{activeDef.description}</p>
          </div>
          <button
            type="button"
            onClick={() => onFilter('all')}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            إلغاء الفلتر
          </button>
        </div>
      )}
    </div>
  );
};

export default LeadStatsBar;
