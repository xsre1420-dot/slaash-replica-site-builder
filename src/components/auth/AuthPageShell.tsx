import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AuthPageShellProps {
  children: ReactNode;
  panelTitle: string;
  panelSubtitle: string;
  panelContent: ReactNode;
  footer?: ReactNode;
}

export const AuthLoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center font-arabic" dir="rtl">
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm">جاري التحميل…</p>
    </div>
  </div>
);

export const AuthPageShell = ({
  children,
  panelTitle,
  panelSubtitle,
  panelContent,
  footer,
}: AuthPageShellProps) => (
  <div className="min-h-screen bg-background font-arabic" dir="rtl">
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-secondary" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px]" />
        <div className="relative z-10 flex flex-col justify-center p-16 text-primary-foreground">
          <img
            src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png"
            alt="بداية"
            className="h-12 w-auto mb-12 brightness-0 invert"
          />
          <h1 className="text-4xl font-bold mb-4 leading-tight">{panelTitle}</h1>
          <p className="text-lg text-primary-foreground/70 mb-12">{panelSubtitle}</p>
          {panelContent}
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col">
        <header className="py-5 px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <img src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png" alt="بداية" className="h-8 w-auto" />
          </Link>
          <Link to="/" className="hidden lg:block text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← العودة للرئيسية
          </Link>
          <ThemeToggle />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        <footer className="text-center py-5 text-muted-foreground/50 text-xs">
          {footer ?? 'جميع الحقوق محفوظة © 2025 بداية'}
        </footer>
      </div>
    </div>
  </div>
);
