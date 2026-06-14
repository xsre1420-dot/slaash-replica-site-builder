import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AuthPageShellProps {
  children: ReactNode;
  footer?: ReactNode;
}

export const AuthLoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center font-arabic" dir="rtl">
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
      <p className="text-sm font-medium">جاري التحميل…</p>
    </div>
  </div>
);

export const AuthPageShell = ({ children, footer }: AuthPageShellProps) => (
  <div className="min-h-screen bg-background font-arabic" dir="rtl">
    <div className="flex min-h-screen">
      {/* Premium side panel — visual only, no marketing copy */}
      <aside
        className="relative hidden lg:flex lg:w-[44%] xl:w-1/2 flex-col items-center justify-center overflow-hidden bg-primary"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/90" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/[0.06]" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/[0.04]" />

        <div className="relative z-10 flex flex-col items-center justify-center px-12 py-16">
          <img
            src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png"
            alt="بداية"
            className="h-11 w-auto brightness-0 invert"
          />
          <div className="mt-10 h-px w-16 bg-white/20" />
        </div>
      </aside>

      <div className="flex w-full flex-col lg:w-[56%] xl:w-1/2">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
          <Link to="/" className="flex items-center lg:hidden">
            <img
              src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png"
              alt="بداية"
              className="h-8 w-auto"
            />
          </Link>
          <Link
            to="/"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:inline-flex"
          >
            ← العودة للرئيسية
          </Link>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-5 pb-6 pt-2 sm:px-8 sm:pb-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>

        <footer className="py-4 text-center text-xs text-muted-foreground/60 sm:py-5">
          {footer ?? 'جميع الحقوق محفوظة © 2025 بداية'}
        </footer>
      </div>
    </div>
  </div>
);
