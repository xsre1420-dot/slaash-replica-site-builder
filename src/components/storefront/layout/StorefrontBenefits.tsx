import { ShieldCheck, Truck, RotateCcw, BadgeCheck } from 'lucide-react';

const benefits = [
  { icon: Truck, label: 'توصيل سريع', desc: 'لجميع المحافظات' },
  { icon: ShieldCheck, label: 'دفع آمن', desc: '100% محمي' },
  { icon: BadgeCheck, label: 'متجر موثوق', desc: 'جودة مضمونة' },
  { icon: RotateCcw, label: 'إرجاع سهل', desc: 'سياسة واضحة' },
];

const StorefrontBenefits = () => (
  <section className="sf-container py-6 sm:py-8">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {benefits.map(({ icon: Icon, label, desc }) => (
        <div key={label} className="sf-benefit-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default StorefrontBenefits;
