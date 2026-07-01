import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Shield } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import AdminPrivateMeta from '@/components/admin/AdminPrivateMeta';
import {
  ADMIN_LOGO_SRC,
  adminBrandBadgeClass,
  adminCardClass,
  adminShellClass,
} from '@/components/admin/adminVisualStyles';

interface AdminAuthShellProps {
  children: ReactNode;
}

export const AdminAuthLoadingScreen = () => (
  <div className={`${adminShellClass} flex items-center justify-center`} dir="rtl">
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm font-medium">جاري التحميل…</p>
    </div>
  </div>
);

export const AdminAuthShell = ({ children }: AdminAuthShellProps) => (
  <div className={adminShellClass} dir="rtl">
    <div
      className="pointer-events-none fixed inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent"
      aria-hidden
    />
    <AdminPrivateMeta title="دخول الإدارة" />
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <img src={ADMIN_LOGO_SRC} alt="بداية" className="h-8 w-auto shrink-0" />
          <span className={adminBrandBadgeClass}>
            <Shield className="h-3 w-3" strokeWidth={2} />
            لوحة المبيعات
          </span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            موقع المنصة
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-6 pt-2 sm:px-8 sm:pb-10">
        <div className={`max-w-[420px] ${adminCardClass}`}>{children}</div>
      </main>

      <footer className="relative py-4 text-center text-xs text-muted-foreground/70 sm:py-5">
        <p>بوابة داخلية — إدارة طلبات الاشتراك للمسؤولين فقط</p>
        <p className="mt-1 hidden sm:block">جميع الحقوق محفوظة © 2025 بداية</p>
      </footer>
    </div>
  </div>
);
