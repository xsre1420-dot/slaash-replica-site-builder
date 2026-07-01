import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  UserCheck,
  CreditCard,
  LayoutDashboard,
  LogOut,
  KeyRound,
  Clock,
  Inbox,
  ExternalLink,
  Sparkles,
  GitBranch,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ADMIN_LOGO_SRC } from '@/components/admin/adminVisualStyles';
import { fetchLeadStats, type LeadStatsPayload } from '@/services/leadAdminService';
import { useVisibilityAwareInterval } from '@/hooks/useVisibilityAwareInterval';

type AdminSidebarProps = {
  onNavigate?: () => void;
  userEmail?: string | null;
  onLogout?: () => void;
};

const mainNav = [
  { to: '/admin/leads', icon: Users, label: 'طلبات الاشتراك', end: false },
  { to: '/admin/subscriptions', icon: CreditCard, label: 'الاشتراكات', end: false },
  { to: '/admin/customers', icon: UserCheck, label: 'العملاء', end: false },
  { to: '/admin/health', icon: Activity, label: 'صحة المنصة', end: false },
];

const quickLinks = [
  {
    to: '/admin/leads?filter=unread',
    icon: Inbox,
    label: 'غير مقروء',
    statKey: 'unread_count' as const,
    accent: 'text-blue-600 bg-blue-500/10',
  },
  {
    to: '/admin/leads?filter=needs_code',
    icon: KeyRound,
    label: 'يحتاج رمز',
    statKey: 'needs_code_count' as const,
    accent: 'text-violet-600 bg-violet-500/10',
  },
  {
    to: '/admin/leads?filter=pending_activation',
    icon: Clock,
    label: 'بانتظار التفعيل',
    statKey: 'pending_activation_count' as const,
    accent: 'text-amber-600 bg-amber-500/10',
  },
  {
    to: '/admin/leads?filter=pipeline',
    icon: GitBranch,
    label: 'قيد المعالجة',
    statKey: 'pipeline_count' as const,
    accent: 'text-indigo-600 bg-indigo-500/10',
  },
];

const AdminSidebar = ({ onNavigate, userEmail, onLogout }: AdminSidebarProps) => {
  const location = useLocation();
  const [stats, setStats] = useState<LeadStatsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchLeadStats().then((data) => {
      if (!cancelled) setStats(data);
    });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  useVisibilityAwareInterval(() => {
    void fetchLeadStats().then(setStats);
  }, 60_000);

  const isActive = (to: string) => {
    const [path, query] = to.split('?');
    if (query) {
      const filterVal = query.split('=')[1] ?? '';
      return location.pathname === path && location.search.includes(`filter=${filterVal}`);
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleClick = () => onNavigate?.();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="border-b border-border/50 px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src={ADMIN_LOGO_SRC}
            alt="بداية"
            className="h-9 w-9 shrink-0 rounded-xl border border-primary/15 bg-background object-contain p-1"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">لوحة المبيعات</p>
            <p className="text-[11px] text-muted-foreground">إدارة الاشتراكات — بداية</p>
          </div>
        </div>
      </div>

      {/* Today snapshot */}
      {stats && (
        <div className="mx-3 mt-3 rounded-xl border border-primary/15 bg-gradient-to-br from-primary/8 to-transparent p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-primary mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            ملخص اليوم
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-background/80 px-2 py-2">
              <p className="text-lg font-bold tabular-nums">{stats.today_count}</p>
              <p className="text-[10px] text-muted-foreground">طلب اليوم</p>
            </div>
            <div className="rounded-lg bg-background/80 px-2 py-2">
              <p className="text-lg font-bold tabular-nums text-emerald-600">{stats.customer_count}</p>
              <p className="text-[10px] text-muted-foreground">عميل مُفعّل</p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Main nav */}
        <div>
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            القائمة الرئيسية
          </p>
          <div className="space-y-1">
            {mainNav.map((item) => {
              const active =
                item.to === '/admin/leads'
                  ? location.pathname.startsWith('/admin/leads') && !location.search.includes('filter=')
                  : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={handleClick}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all min-h-[44px]',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                      active ? 'bg-primary-foreground/15' : 'bg-muted group-hover:bg-muted'
                    )}
                  >
                    <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.to === '/admin/leads' && (stats?.unread_count ?? 0) > 0 && (
                    <Badge
                      variant={active ? 'secondary' : 'destructive'}
                      className="h-5 min-w-5 px-1.5 text-[10px]"
                    >
                      {stats!.unread_count > 99 ? '99+' : stats!.unread_count}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick filters */}
        <div>
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            متابعة سريعة
          </p>
          <div className="space-y-1">
            {quickLinks.map((item) => {
              const count = stats?.[item.statKey] ?? 0;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={handleClick}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all min-h-[40px]',
                    active
                      ? 'bg-muted font-medium text-foreground ring-1 ring-border'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', item.accent)}>
                    <item.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 text-[13px]">{item.label}</span>
                  {count > 0 && (
                    <span className="text-xs font-semibold tabular-nums text-foreground/70">{count}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* External */}
        <div>
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            روابط
          </p>
          <div className="space-y-1">
            <Link
              to="/builder"
              onClick={handleClick}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground min-h-[44px]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <LayoutDashboard className="h-4 w-4" strokeWidth={1.75} />
              </span>
              لوحة التاجر
            </Link>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground min-h-[44px]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
              </span>
              موقع المنصة
            </a>
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-border/50 p-3 space-y-2">
        {userEmail && (
          <p className="truncate px-2 text-[11px] text-muted-foreground" dir="ltr" title={userEmail}>
            {userEmail}
          </p>
        )}
        {onLogout && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start rounded-xl gap-2 text-muted-foreground hover:text-destructive"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdminSidebar;
