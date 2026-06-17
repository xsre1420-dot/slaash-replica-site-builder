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
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import PlatformDbStatusBanner from '@/components/platform/PlatformDbStatusBanner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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

  const sidebarWidth = collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]';
  const mainOffset = collapsed ? 'lg:mr-[72px]' : 'lg:mr-[260px]';

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background font-arabic flex" dir="rtl">
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
        <div className={cn('flex-1 flex flex-col min-h-screen transition-all duration-300', mainOffset)}>
          {/* Mobile top bar */}
          <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card">
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
              <SheetContent side="right" className="w-72 p-0 font-arabic bg-sidebar border-sidebar-border">
                <div className="p-5 border-b border-sidebar-border">
                  <div className="flex items-center gap-3">
                    {storeLogo ? (
                      <img src={storeLogo} alt="" className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <LayoutDashboard className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-foreground">{storeName || 'متجري'}</p>
                      <p className="text-xs text-muted-foreground">{user?.username}</p>
                    </div>
                  </div>
                </div>
                <nav className="py-3 overflow-y-auto">
                  {navGroups.map((group) => (
                    <div key={group.label} className="px-3 mb-4">
                      <p className="ds-section-title px-3 mb-2">{group.label}</p>
                      <div className="space-y-0.5">
                        {group.items.map((item) => (
                          <NavLink key={item.to} {...item} />
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
                <div className="absolute bottom-0 inset-x-0 p-4 border-t border-sidebar-border bg-sidebar space-y-2">
                  <Link to="/preview" onClick={() => setMenuOpen(false)}>
                    <Button variant="outline" className="w-full rounded-xl gap-2">
                      <Eye className="w-4 h-4" />
                      معاينة المتجر
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => { setMenuOpen(false); handleLogout(); }}
                    className="w-full rounded-xl gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4" />
                    تسجيل الخروج
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/builder" className="font-semibold text-foreground text-sm truncate max-w-[50%]">
              {isHome ? storeName || 'لوحة التحكم' : storeName || 'متجري'}
            </Link>

            <ThemeToggle />
          </header>

          <main id="main-content" className="flex-1">
            <PlatformDbStatusBanner />
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default DashboardLayout;
