import { Info } from 'lucide-react';

const InventoryAutoDeductionNotice = () => (
  <div
    className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5 text-right"
    dir="rtl"
    role="status"
  >
    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
    <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
      <span className="font-medium text-foreground">الخصم تلقائي:</span> يُنقص المخزون عند كل طلب من
      المتجر، ويُسترد تلقائياً عند إلغاء الطلب. من هنا يمكنك{' '}
      <span className="font-medium text-foreground">إعادة التعبئة</span> فقط — وليس خصم الكميات يدوياً.
    </p>
  </div>
);

export default InventoryAutoDeductionNotice;
