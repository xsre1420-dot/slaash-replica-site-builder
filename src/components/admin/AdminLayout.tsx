import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Bell,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { fetchUnreadLeadsCount } from '@/services/leadAdminService';
import AdminPrivateMeta from '@/components/admin/AdminPrivateMeta';

const adminNav = [
  { to: '/admin/leads', icon: Users, label: 'طلبات الاشتراك' },
  { to: '/admin/subscriptions', icon: CreditCard, label: 'الاشتراكات' },
  { to: '/admin/customers', icon: UserCheck, label: 'العملاء' },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const AdminLayout = ({ children, title = 'لوحة الإدارة' }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    void fetchUnreadLeadsCount().then(setUnread);
    const interval = setInterval(() => {
      void fetchUnreadLeadsCount().then(setUnread);
    }, 60000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {adminNav.map((item) => {
        const active = isActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => mobile && setMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.to === '/admin/leads' && unread > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                {unread > 99 ? '99+' : unread}
              </Badge>
            )}
          </Link>
        );
      })}
      <Link
        to="/builder"
        onClick={() => mobile && setMenuOpen(false)}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <LayoutDashboard className="w-4 h-4" />
        لوحة التاجر
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-muted/20 font-arabic" dir="rtl">
      <AdminPrivateMeta title={title} />
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-4 font-arabic">
                <p className="font-bold mb-1">{title}</p>
                <p className="text-xs text-muted-foreground mb-4">للمسؤولين فقط</p>
                <nav className="space-y-1">
                  <NavItems mobile />
                </nav>
              </SheetContent>
            </Sheet>
            <div>
              <h1 className="font-bold text-foreground">{title}</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">لوحة المبيعات — للمسؤولين فقط</p>
            </div>
            {unread > 0 && (
              <Badge variant="secondary" className="gap-1 hidden sm:flex">
                <Bell className="w-3 h-3" />
                {unread} طلب جديد
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <LogOut className="w-4 h-4 ml-1" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex gap-6 p-4 lg:p-6">
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-20 space-y-1 rounded-2xl border border-border/50 bg-card p-2">
            <NavItems />
          </nav>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
