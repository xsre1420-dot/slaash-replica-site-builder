import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AuthPageShellProps {
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Wider form layout (~576px) for multi-field pages */
  form?: boolean;
}

export const AuthLoadingScreen = () => (
  <div className="min-h-screen bg-white flex items-center justify-center font-arabic" dir="rtl">
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
      <p className="text-sm font-medium">جاري التحميل…</p>
    </div>
  </div>
);

export const AuthPageShell = ({ children, footer, wide = false, form = false }: AuthPageShellProps) => (
  <div className="min-h-screen bg-white font-arabic" dir="rtl">
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <Link to="/" className="flex items-center">
          <img
            src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png"
            alt="بداية"
            className="h-8 w-auto"
          />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            العودة للرئيسية
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-6 pt-2 sm:px-8 sm:pb-10">
        <div
          className={
            wide ? 'w-full max-w-5xl' : form ? 'w-full max-w-xl' : 'w-full max-w-[400px]'
          }
        >
          {children}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground/60 sm:py-5">
        {footer ?? 'جميع الحقوق محفوظة © 2025 بداية'}
      </footer>
    </div>
  </div>
);
