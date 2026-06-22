import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const links = [
  { href: '#features', label: 'المميزات' },
  { href: '#demo', label: 'لوحة التحكم' },
  { href: '#pricing', label: 'الباقات' },
  { href: '#faq', label: 'الأسئلة' },
];

const LandingNav = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="landing-nav-wrap">
      <div
        className={cn(
          'landing-nav-pill mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-3 sm:px-4 transition-shadow duration-300',
          scrolled && 'landing-nav-pill--scrolled'
        )}
      >
        <Link to="/" className="flex shrink-0 items-center gap-2 ps-1">
          <img
            src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png"
            alt="بداية"
            className="h-8 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#111827]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm" className="rounded-full text-[#64748b] hover:text-[#111827]">
              تسجيل الدخول
            </Button>
          </Link>
          <a href="#pricing">
            <Button size="sm" className="rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90">
              ابدأ الآن
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
};

export default LandingNav;
