import {
  BarChart3,
  LayoutDashboard,
  Megaphone,
  Package,
  ShoppingBag,
  Warehouse,
} from 'lucide-react';
import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';

const features = [
  {
    icon: LayoutDashboard,
    tag: 'BUILDER',
    title: 'منشئ المتجر',
    desc: 'صمّم واجهة متجرك، غيّر الألوان والشعار، وانشر خلال دقائق.',
  },
  {
    icon: Package,
    tag: 'PRODUCTS',
    title: 'إدارة المنتجات',
    desc: 'أضف منتجات غير محدودة مع صور، أسعار، وتصنيفات منظمة.',
  },
  {
    icon: ShoppingBag,
    tag: 'ORDERS',
    title: 'إدارة الطلبات',
    desc: 'تابع كل طلب من الاستلام حتى التسليم في مسار عمل واضح.',
  },
  {
    icon: Warehouse,
    tag: 'INVENTORY',
    title: 'المخزون',
    desc: 'راقب الكميات، تنبيهات النفاد، وخصم تلقائي عند البيع.',
  },
  {
    icon: Megaphone,
    tag: 'MARKETING',
    title: 'أدوات التسويق',
    desc: 'كوبونات، عروض، وتتبع حملاتك لزيادة المبيعات.',
  },
  {
    icon: BarChart3,
    tag: 'ANALYTICS',
    title: 'لوحة التحليلات',
    desc: 'إحصائيات مبيعات وزيارات وأداء في الوقت الفعلي.',
  },
];

const LandingFeatures = () => (
  <section id="features" className="landing-section">
    <div className="container mx-auto px-4">
      <FadeUp>
        <SectionTitle
          eyebrow="مميزات المنصة"
          title={
            <>
              كل ما يحتاجه متجرك{' '}
              <span className="text-primary">في مكان واحد</span>
            </>
          }
          subtitle="أدوات enterprise مصمّمة لتجّار التجزئة الذين يريدون النمو بسرعة — بدون فريق تقني."
        />
      </FadeUp>

      <div className="mx-auto mt-14 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <FadeUp key={feature.title} delay={i * 0.06}>
              <article className="landing-card group h-full p-6 sm:p-7">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[#64748b]">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#111827]">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-[#64748b]">{feature.desc}</p>
              </article>
            </FadeUp>
          );
        })}
      </div>
    </div>
  </section>
);

export default LandingFeatures;
