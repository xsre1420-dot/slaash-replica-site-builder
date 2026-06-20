import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Settings,
  BarChart3,
  Archive,
  TrendingUp,
  Eye,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  ExternalLink,
  LogOut,
  Store,
  X,
  Shield,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import PlatformDbStatusBanner from '@/components/platform/PlatformDbStatusBanner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navGroups = [
  {
    label: 'الرئيسية',
    items: [
      { to: '/builder', icon: LayoutDashboard, label: 'لوحة التحكم' },
      { to: '/orders', icon: ShoppingBag, label: 'الطلبات' },
      { to: '/products', icon: Package, label: 'المنتجات' },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { to: '/inventory', icon: Archive, label: 'المخزون' },
      { to: '/marketing', icon: TrendingUp, label: 'التسويق' },
      { to: '/statistics', icon: BarChart3, label: 'الإحصائيات' },
    ],
  },
  {
    label: 'الحساب',
    items: [
      { to: '/settings', icon: Settings, label: 'الإعدادات' },
    ],
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  isHome?: boolean;
}

const DashboardLayout = ({ children, isHome = false }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { storeName, storeLogo } = useStore();
  const { user, logout } = useAuth();
  const { isAdmin } = useSubscription();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  const isActive = (to: string) => {
    if (to === '/products') {
      return (
        location.pathname === to ||
        location.pathname.startsWith('/add-product') ||
        location.pathname.startsWith('/edit-product')
      );
    }
    if (to === '/orders') {
      return location.pathname === to || location.pathname.startsWith('/orders/');
    }
    return location.pathname === to || (to !== '/builder' && location.pathname.startsWith(to));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const NavLink = ({
    to,
    icon: Icon,
    label,
    collapsed: isCollapsed,
  }: {
    to: string;
    icon: typeof LayoutDashboard;
    label: string;
    collapsed?: boolean;
  }) => {
    const active = isActive(to);
    const link = (
      <Link
        to={to}
        onClick={() => setMenuOpen(false)}
        className={cn(
          'group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 min-h-[44px]',
          isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
        )}
        aria-current={active ? 'page' : undefined}
      >
        <Icon
          className={cn('shrink-0 transition-transform', isCollapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]')}
          strokeWidth={active ? 2.25 : 1.75}
        />
        {!isCollapsed && <span className="truncate">{label}</span>}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="left" className="font-arabic text-xs">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  const MobileNavLink = ({
    to,
    icon: Icon,
    label,
  }: {
    to: string;
    icon: typeof LayoutDashboard;
    label: string;
  }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        onClick={() => setMenuOpen(false)}
        className={cn(
          'flex items-center gap-2.5 rounded-xl px-2.5 py-2 min-h-[44px] transition-all duration-200 active:scale-[0.98]',
          active
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/15'
            : 'text-foreground/85 hover:bg-sidebar-accent/80'
        )}
        aria-current={active ? 'page' : undefined}
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            active
              ? 'bg-primary-foreground/15 text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground'
          )}
        >
          <Icon className="w-4 h-4" strokeWidth={active ? 2.25 : 2} />
        </span>
        <span className="text-sm font-medium leading-none">{label}</span>
      </Link>
    );
  };

  const sidebarWidth = collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]';
  const mainOffset = collapsed ? 'lg:mr-[72px]' : 'lg:mr-[260px]';

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background font-arabic flex w-full max-w-[100vw] overflow-x-hidden" dir="rtl">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:outline-none"
        >
          تخطي إلى المحتوى
        </a>
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-l border-sidebar-border bg-sidebar fixed inset-y-0 right-0 z-40 transition-all duration-300 ease-in-out',
            sidebarWidth
          )}
        >
          <div className={cn('border-b border-sidebar-border', collapsed ? 'p-3' : 'p-4')}>
            <Link
              to="/builder"
              className={cn(
                'flex items-center group',
                collapsed ? 'justify-center' : 'gap-3'
              )}
            >
              {storeLogo ? (
                <img
                  src={storeLogo}
                  alt=""
                  className="w-9 h-9 rounded-xl object-cover border border-primary/15 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <LayoutDashboard className="w-[18px] h-[18px] text-primary" />
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sidebar-foreground truncate text-sm leading-tight">
                    {storeName || 'متجري'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {user?.username || 'لوحة التاجر'}
                  </p>
                </div>
              )}
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto scrollbar-hide py-3" aria-label="القائمة الرئيسية">
            {navGroups.map((group) => (
              <div key={group.label} className={cn('mb-4', collapsed ? 'px-2' : 'px-3')}>
                {!collapsed && (
                  <p className="ds-section-title px-3 mb-2">{group.label}</p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink key={item.to} {...item} collapsed={collapsed} />
                  ))}
                </div>
              </div>
            ))}
            {isAdmin && (
              <div className={cn('mb-4', collapsed ? 'px-2' : 'px-3')}>
                {!collapsed && <p className="ds-section-title px-3 mb-2">المنصة</p>}
                <NavLink to="/admin/leads" icon={Shield} label="إدارة العملاء المحتملين" collapsed={collapsed} />
              </div>
            )}
          </nav>

          <div className={cn('border-t border-sidebar-border space-y-2', collapsed ? 'p-2' : 'p-3')}>
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link to="/preview">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-full rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary hover:border-primary/30 min-h-[44px] min-w-[44px]"
                      aria-label="معاينة المتجر"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="left" className="font-arabic text-xs">
                  معاينة المتجر
                </TooltipContent>
              </Tooltip>
            ) : (
              <Link to="/preview">
                <Button
                  variant="outline"
                  className="w-full rounded-xl justify-start gap-2 min-h-[44px] border-primary/20 hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                >
                  <ExternalLink className="w-4 h-4" />
                  معاينة المتجر
                </Button>
              </Link>
            )}

            <div
              className={cn(
                'flex items-center',
                collapsed ? 'flex-col gap-2' : 'justify-between px-1'
              )}
            >
              {!collapsed && <span className="text-xs text-muted-foreground">المظهر</span>}
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent shrink-0"
                aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
              >
                {collapsed ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
              </Button>
            </div>

            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="w-full rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label="تسجيل الخروج"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="font-arabic text-xs">تسجيل الخروج</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full rounded-xl justify-start gap-2 min-h-[44px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </Button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className={cn('flex-1 flex flex-col min-h-screen min-w-0 w-full max-w-full transition-all duration-300', mainOffset)}>
          {/* Mobile top bar */}
          <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card w-full min-w-0 shrink-0">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl min-h-[44px] min-w-[44px] hover:bg-muted"
                  aria-label="فتح القائمة"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className={cn(
                  'w-[min(268px,80vw)] p-0 font-arabic bg-sidebar border-l border-sidebar-border/50',
                  'flex flex-col max-h-[100dvh] shadow-2xl shadow-black/10',
                  '[&>button]:hidden'
                )}
              >
                <div className="relative shrink-0 border-b border-sidebar-border/50 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent px-4 py-3.5">
                  <div className="flex items-center justify-between gap-4" dir="rtl">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
                        {storeLogo ? (
                          <img
                            src={storeLogo}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-primary/10">
                            <Store className="h-4 w-4 text-primary" strokeWidth={2} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 text-right">
                        <p className="truncate text-sm font-bold leading-snug text-foreground">
                          {storeName || 'متجري'}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          لوحة التحكم
                        </p>
                      </div>
                    </div>

                    <SheetClose asChild>
                      <button
                        type="button"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="إغلاق القائمة"
                      >
                        <X className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </SheetClose>
                  </div>
                </div>

                <nav
                  className="flex-1 min-h-0 overflow-y-auto mobile-sidebar-scroll py-3.5 px-2.5"
                  aria-label="القائمة الرئيسية"
                >
                  {navGroups.map((group, groupIndex) => (
                    <div
                      key={group.label}
                      className={cn('px-0.5', groupIndex > 0 ? 'mt-4' : '')}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/75 px-2.5 mb-1.5">
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.items.map((item) => (
                          <MobileNavLink key={item.to} {...item} />
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>

                <div className="shrink-0 border-t border-sidebar-border/50 bg-sidebar/95 backdrop-blur-sm p-3 space-y-2 safe-area-bottom">
                  <Link to="/preview" onClick={() => setMenuOpen(false)}>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl justify-start gap-2.5 min-h-[44px] px-2.5 text-sm border-primary/20 bg-background/50 hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Eye className="h-4 w-4 text-primary" strokeWidth={2.25} />
                      </span>
                      معاينة المتجر
                    </Button>
                  </Link>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleLogout();
                      }}
                      className="h-11 flex-1 min-h-0 min-w-0 justify-start gap-2.5 rounded-xl border border-border/50 bg-background/40 px-3 text-muted-foreground hover:border-destructive/30 hover:text-destructive hover:bg-destructive/10"
                      aria-label="تسجيل الخروج"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 ring-1 ring-destructive/15">
                        <LogOut className="h-4 w-4 text-destructive" strokeWidth={2.25} />
                      </span>
                      <span className="text-xs font-medium">تسجيل الخروج</span>
                    </Button>
                    <ThemeToggle
                      yellowSun
                      iconClassName="h-3.5 w-3.5"
                      className="h-9 w-9 shrink-0 rounded-xl border border-border/50 bg-background/40 hover:bg-background [&_svg]:h-3.5 [&_svg]:w-3.5"
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/builder" className="font-semibold text-foreground text-sm truncate max-w-[50%]">
              {isHome ? storeName || 'لوحة التحكم' : storeName || 'متجري'}
            </Link>

            <ThemeToggle />
          </header>

          <main id="main-content" className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden">
            <PlatformDbStatusBanner />
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default DashboardLayout;
