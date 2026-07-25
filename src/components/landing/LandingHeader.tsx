import { Link } from 'react-router-dom';
import { Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

type LandingHeaderProps = {
  scrolled?: boolean;
};

const navLinks = [
  { href: '/', label: 'الرئيسية', active: true },
  { href: '#features', label: 'المميزات' },
  { href: '#pricing', label: 'الأسعار' },
  { href: '#features', label: 'الموارد' },
  { href: '#contact', label: 'العملاء' },
];

const LandingHeader = ({ scrolled = false }: LandingHeaderProps) => (
  <header className="lp-header sticky top-0 z-50">
    <div className={cn('lp-header-shell', scrolled && 'lp-header-shell--scrolled')}>
      <Link to="/" className="shrink-0" aria-label="بداية — الصفحة الرئيسية">
        <img
          src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png"
          alt="بداية"
          className="h-8 w-auto sm:h-10 lg:h-11"
        />
      </Link>

      <nav className="lp-header-nav flex items-center justify-center gap-0.5" aria-label="التنقل الرئيسي">
        {navLinks.map(({ href, label, active }) => (
          <a
            key={label}
            href={href}
            className={cn('lp-header-nav-link', active && 'lp-header-nav-link--active')}
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="lp-header-login inline-flex h-11 rounded-full px-4 text-sm font-medium text-foreground hover:bg-muted/60 sm:px-5"
        >
          <Link to="/login">
            <User className="ms-1.5 h-4 w-4" strokeWidth={2} />
            تسجيل الدخول
          </Link>
        </Button>
        <a href="#pricing" className="shrink-0">
          <Button size="sm" className="lp-header-cta h-11 gap-2 rounded-full px-5 font-semibold sm:px-6">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            الباقات
          </Button>
        </a>
      </div>
    </div>
  </header>
);

export default LandingHeader;
