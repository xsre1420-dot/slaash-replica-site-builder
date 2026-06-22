import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Shield } from 'lucide-react';
import AdminPrivateMeta from '@/components/admin/AdminPrivateMeta';

interface AdminAuthShellProps {
  children: ReactNode;
}

export const AdminAuthLoadingScreen = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center font-arabic" dir="rtl">
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <Loader2 className="w-7 h-7 animate-spin text-slate-200" />
      <p className="text-sm font-medium">جاري التحميل…</p>
    </div>
  </div>
);

export const AdminAuthShell = ({ children }: AdminAuthShellProps) => (
  <div className="min-h-screen bg-slate-950 font-arabic text-slate-100" dir="rtl">
    <AdminPrivateMeta title="دخول الإدارة" />
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700">
            <Shield className="h-4 w-4 text-slate-200" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">لوحة المبيعات</p>
            <p className="text-[11px] text-slate-400">إدارة طلبات الاشتراك — للمسؤولين فقط</p>
          </div>
        </div>
        <Link
          to="/"
          className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
        >
          موقع المنصة
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-8 sm:px-8">
        <div className="w-full max-w-[400px] rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
          {children}
        </div>
      </main>

      <footer className="py-4 text-center text-[11px] text-slate-500">
        بوابة داخلية — غير مخصصة للتجار
      </footer>
    </div>
  </div>
);
