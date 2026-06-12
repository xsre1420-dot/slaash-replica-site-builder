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
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { to: '/builder', icon: LayoutDashboard, label: 'لوحة التحكم' },
  { to: '/orders', icon: ShoppingBag, label: 'الطلبات' },
  { to: '/products', icon: Package, label: 'المنتجات' },
  { to: '/inventory', icon: Archive, label: 'المخزون' },
  { to: '/marketing', icon: TrendingUp, label: 'التسويق' },
  { to: '/statistics', icon: BarChart3, label: 'الإحصائيات' },
  { to: '/settings', icon: Settings, label: 'الإعدادات' },
];

const mobileNavItems = navItems.slice(0, 5);

interface DashboardLayoutProps {
  children: React.ReactNode;
  /** Hide sidebar/back on dashboard home */
  isHome?: boolean;
}

const DashboardLayout = ({ children, isHome = false }: DashboardLayoutProps) => {
  const location = useLocation();
  const { storeName, storeLogo } = useStore();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const NavLink = ({ to, icon: Icon, label }: { to: string; icon: typeof LayoutDashboard; label: string }) => {
    const active = location.pathname === to || (to !== '/builder' && location.pathname.startsWith(to));
    return (
      <Link
        to={to}
        onClick={() => setMenuOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]',
          active
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        )}
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2 : 1.75} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background font-arabic flex" dir="rtl">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-l border-border/60 bg-card/50 backdrop-blur-sm fixed inset-y-0 right-0 z-40">
        <div className="p-5 border-b border-border/60">
          <Link to="/builder" className="flex items-center gap-3 group">
            {storeLogo ? (
              <img src={storeLogo} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-primary/10" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-foreground truncate text-sm">{storeName || 'متجري'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.username || 'لوحة التاجر'}</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="القائمة الرئيسية">
          {navItems.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>

        <div className="p-3 border-t border-border/60 space-y-2">
          <Link to="/preview">
            <Button variant="outline" className="w-full rounded-xl justify-start gap-2 min-h-[44px] border-primary/20 hover:bg-primary/5 hover:text-primary">
              <Eye className="w-4 h-4" />
              معاينة المتجر
            </Button>
          </Link>
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground">المظهر</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:mr-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/90 backdrop-blur-md">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl min-h-[44px] min-w-[44px]" aria-label="فتح القائمة">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 font-arabic">
              <div className="p-5 border-b border-border">
                <p className="font-bold text-foreground">{storeName || 'متجري'}</p>
                <p className="text-xs text-muted-foreground">{user?.username}</p>
              </div>
              <nav className="p-3 space-y-1">
                {navItems.map((item) => (
                  <NavLink key={item.to} {...item} />
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/builder" className="font-bold text-foreground text-sm truncate max-w-[50%]">
            {isHome ? (storeName || 'لوحة التحكم') : storeName || 'متجري'}
          </Link>

          <ThemeToggle />
        </header>

        <main className="flex-1 pb-20 lg:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/60 safe-area-bottom"
          aria-label="التنقل السريع"
        >
          <div className="flex items-stretch justify-around px-1 py-1">
            {mobileNavItems.map(({ to, icon: Icon, label }) => {
              const active = location.pathname === to || (to !== '/builder' && location.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[52px] rounded-lg transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default DashboardLayout;
