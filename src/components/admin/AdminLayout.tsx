import { useNavigate } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import AdminPrivateMeta from '@/components/admin/AdminPrivateMeta';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { adminPageBgClass } from '@/components/admin/adminVisualStyles';
import { fetchLeadStats } from '@/services/leadAdminService';
import { useEffect } from 'react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const AdminLayout = ({ children, title = 'لوحة الإدارة' }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    void fetchLeadStats().then((s) => setUnread(s?.unread_count ?? 0));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className={adminPageBgClass} dir="rtl">
      <AdminPrivateMeta title={title} />

      {/* Top bar — mobile only actions */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl shrink-0">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] p-0 font-arabic">
                <AdminSidebar
                  onNavigate={() => setMenuOpen(false)}
                  userEmail={user?.email}
                  onLogout={() => void handleLogout()}
                />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <h1 className="font-bold text-sm truncate">{title}</h1>
              <p className="text-[10px] text-muted-foreground">لوحة المبيعات</p>
            </div>
          </div>
          {unread > 0 && (
            <Badge variant="destructive" className="gap-1 shrink-0">
              <Bell className="w-3 h-3" />
              {unread}
            </Badge>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-0 lg:gap-6 lg:p-5">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-[260px] shrink-0">
          <div className="sticky top-5 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03]">
            <AdminSidebar userEmail={user?.email} onLogout={() => void handleLogout()} />
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <div className="hidden lg:flex items-center justify-between mb-5 px-1">
            <div>
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">إدارة طلبات الاشتراك والعملاء</p>
            </div>
            {unread > 0 && (
              <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                <Bell className="w-3.5 h-3.5" />
                {unread} طلب جديد بانتظارك
              </Badge>
            )}
          </div>
          <div className="p-4 lg:p-0 lg:rounded-2xl lg:border lg:border-border/40 lg:bg-card lg:p-6 lg:shadow-sm lg:shadow-black/[0.02]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
