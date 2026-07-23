import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Settings,
  BarChart3,
  TrendingUp,
  Eye,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  ExternalLink,
  LogOut,
  Store,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import PlatformDbStatusBanner from '@/components/platform/PlatformDbStatusBanner';
import RealtimeReconnectBanner from '@/components/RealtimeReconnectBanner';
import SubscriptionExpiryBanner from '@/components/dashboard/SubscriptionExpiryBanner';
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
    index = 0,
  }: {
    to: string;
    icon: typeof LayoutDashboard;
    label: string;
    index?: number;
  }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        onClick={() => setMenuOpen(false)}
        className={cn(
          'ds-mobile-nav-link sf-enter',
          active ? 'ds-mobile-nav-link-active' : 'ds-mobile-nav-link-inactive'
        )}
        style={{ ['--sf-stagger' as string]: index }}
        aria-current={active ? 'page' : undefined}
      >
        <Icon
          className="w-[18px] h-[18px] shrink-0"
          strokeWidth={active ? 2.25 : 1.75}
        />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  let mobileNavIndex = 0;

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
          <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-background/95 backdrop-blur-md w-full min-w-0 shrink-0">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl min-h-[44px] min-w-[44px] hover:bg-muted/60 active:scale-95 transition-transform duration-150"
                  aria-label="فتح القائمة"
                  aria-expanded={menuOpen}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className={cn(
                  'w-[min(280px,84vw)] p-0 font-arabic bg-sidebar border-l border-sidebar-border/40',
                  'flex flex-col max-h-[100dvh]',
                  '[&>button]:hidden'
                )}
              >
                <div className="ds-mobile-sheet-header">
                  <div className="flex items-center justify-between gap-3" dir="rtl">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {storeLogo ? (
                        <img
                          src={storeLogo}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-xl object-cover border border-border/40"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <Store className="h-4 w-4 text-primary" strokeWidth={2} />
                        </div>
                      )}

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
                        className="sf-icon-btn h-9 w-9 shrink-0"
                        aria-label="إغلاق القائمة"
                      >
                        <X className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                    </SheetClose>
                  </div>
                </div>

                <nav
                  className="flex-1 min-h-0 overflow-y-auto mobile-sidebar-scroll py-3 px-2"
                  aria-label="القائمة الرئيسية"
                >
                  {navGroups.map((group, groupIndex) => (
                    <div
                      key={group.label}
                      className={cn(groupIndex > 0 ? 'mt-5' : '')}
                    >
                      <p className="ds-mobile-nav-group-label">{group.label}</p>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const idx = mobileNavIndex++;
                          return <MobileNavLink key={item.to} {...item} index={idx} />;
                        })}
                      </div>
                    </div>
                  ))}
                </nav>

                <div className="ds-mobile-sheet-footer">
                  <Link to="/preview" onClick={() => setMenuOpen(false)}>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl justify-start gap-2 min-h-[44px] border-primary/20 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors duration-150"
                    >
                      <Eye className="w-4 h-4 shrink-0" strokeWidth={2} />
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
                      className="h-11 flex-1 min-w-0 justify-start gap-2 rounded-xl px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                      aria-label="تسجيل الخروج"
                    >
                      <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
                      <span className="text-sm font-medium">تسجيل الخروج</span>
                    </Button>
                    <ThemeToggle
                      yellowSun
                      iconClassName="h-4 w-4"
                      className="h-11 w-11 shrink-0 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors duration-150"
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
            <RealtimeReconnectBanner />
            <SubscriptionExpiryBanner />
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default DashboardLayout;
