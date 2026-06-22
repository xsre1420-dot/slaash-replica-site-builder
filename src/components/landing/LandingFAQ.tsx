import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FadeUp, SectionTitle } from '@/components/landing/FadeUp';

const faqs = [
  {
    q: 'كم يستغرق تفعيل المتجر؟',
    a: 'بعد إرسال بياناتك والاتفاق على الباقة، يتواصل فريقنا عبر واتساب ويفعّل حسابك — غالباً خلال 24–48 ساعة.',
  },
  {
    q: 'هل أحتاج خبرة برمجية؟',
    a: 'لا. المنصة مصمّمة للتجّار — إضافة منتجات، إدارة طلبات، وتخصيص المتجر من لوحة بسيطة.',
  },
  {
    q: 'كيف أدخل بعد التفعيل؟',
    a: 'ستستلم رمز تفعيل من فريق المبيعات. استخدمه في صفحة تسجيل الدخول للدخول مباشرة إلى لوحتك.',
  },
  {
    q: 'هل المتجر يعمل على الجوال؟',
    a: 'نعم. واجهة المتجر ولوحة التحكم متجاوبة بالكامل على الهاتف والتابلت.',
  },
  {
    q: 'ما الفرق بين باقة 6 أشهر والسنة؟',
    a: 'نفس المميزات — الفرق في المدة والسعر. الباقة السنوية توفّر أكثر على المدى الطويل.',
  },
  {
    q: 'هل يمكنني إدارة المخزون؟',
    a: 'نعم. تتبع الكميات، تعديل المخزون، وخصم تلقائي عند تأكيد الطلبات.',
  },
];

const LandingFAQ = () => (
  <section id="faq" className="landing-section">
    <div className="container mx-auto px-4">
      <FadeUp>
        <SectionTitle
          eyebrow="الأسئلة الشائعة"
          title="كل ما تحتاج معرفته"
          subtitle="إجابات سريعة قبل أن تبدأ."
        />
      </FadeUp>

      <FadeUp delay={0.08}>
        <Accordion type="single" collapsible className="mx-auto mt-12 max-w-2xl space-y-3">
          {faqs.map((item, i) => (
            <AccordionItem
              key={item.q}
              value={`faq-${i}`}
              className="landing-card overflow-hidden border-0 px-1"
            >
              <AccordionTrigger className="px-5 py-4 text-right text-base font-semibold text-[#111827] hover:no-underline [&[data-state=open]]:text-primary">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5 text-sm leading-relaxed text-[#64748b]">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </FadeUp>
    </div>
  </section>
);

export default LandingFAQ;
