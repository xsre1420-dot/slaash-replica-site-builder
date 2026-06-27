import { useEffect, useState } from 'react';
import { User, Phone, MapPin, Home, FileText, Mail, MessageSquare, ShoppingBag, Wallet } from 'lucide-react';
import { CustomerInfo as CustomerInfoType } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CustomerInfoProps {
  customerInfo: CustomerInfoType;
  orderId: string;
  ownerId?: string;
  customerInsights?: { orderCount: number; totalSpent: number };
}

const INTERNAL_NOTES_KEY = (ownerId: string, orderId: string) =>
  `merchant-order-notes:${ownerId}:${orderId}`;

const CustomerInfo = ({ customerInfo, orderId, ownerId, customerInsights }: CustomerInfoProps) => {
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    if (!ownerId) return;
    try {
      const saved = localStorage.getItem(INTERNAL_NOTES_KEY(ownerId, orderId));
      if (saved) setInternalNotes(saved);
    } catch {
      /* ignore */
    }
  }, [ownerId, orderId]);

  const saveInternalNotes = () => {
    if (!ownerId) return;
    try {
      localStorage.setItem(INTERNAL_NOTES_KEY(ownerId, orderId), internalNotes);
      toast.success('تم حفظ الملاحظات الداخلية');
    } catch {
      toast.error('تعذر حفظ الملاحظات');
    }
  };

  const InfoRow = ({
    icon: Icon,
    label,
    value,
    dir,
  }: {
    icon: typeof User;
    label: string;
    value?: string;
    dir?: 'ltr' | 'rtl';
  }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-background/80 border border-border/40">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
        </div>
        <div className="flex-1 text-right min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          <p className="font-semibold text-sm text-foreground break-words" dir={dir}>{value}</p>
        </div>
        {label === 'رقم الهاتف' && (
          <div className="flex gap-1 shrink-0">
            <Button variant="outline" size="icon" className="rounded-lg h-9 w-9" asChild>
              <a href={`tel:${value.replace(/\s/g, '')}`} aria-label="اتصال">
                <Phone className="w-3.5 h-3.5" />
              </a>
            </Button>
            <Button variant="outline" size="icon" className="rounded-lg h-9 w-9" asChild>
              <a href={`https://wa.me/${value.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label="واتساب">
                <MessageSquare className="w-3.5 h-3.5" />
              </a>
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {customerInsights && customerInsights.orderCount > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <ShoppingBag className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-muted-foreground">عدد الطلبات</p>
            </div>
            <p className="text-lg font-bold tabular-nums">{customerInsights.orderCount}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <Wallet className="w-3.5 h-3.5 text-success" />
              <p className="text-[10px] text-muted-foreground">إجمالي الإنفاق</p>
            </div>
            <p className="text-lg font-bold tabular-nums">{customerInsights.totalSpent.toLocaleString()} د.ع</p>
          </div>
        </div>
      )}

      <InfoRow icon={User} label="اسم العميل" value={customerInfo.name} />
      <InfoRow icon={Phone} label="رقم الهاتف" value={customerInfo.phone} dir="ltr" />
      <InfoRow icon={MapPin} label="المحافظة" value={customerInfo.governorate} />
      <InfoRow icon={Home} label="عنوان التوصيل" value={customerInfo.address} />
      {customerInfo.notes && (
        <InfoRow icon={FileText} label="ملاحظات العميل" value={customerInfo.notes} />
      )}

      <div className="rounded-xl border border-dashed border-border/60 p-3 sm:p-4 space-y-3 bg-muted/20">
        <div className="flex items-center gap-2 justify-end">
          <p className="text-sm font-bold text-foreground">ملاحظات داخلية (للتاجر فقط)</p>
          <Mail className="w-4 h-4 text-muted-foreground" />
        </div>
        <Textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="أضف ملاحظات للفريق: موعد التوصيل، تعليمات خاصة..."
          className="rounded-xl min-h-[80px] text-right resize-none text-sm"
        />
        <Button size="sm" variant="secondary" className="rounded-xl w-full sm:w-auto" onClick={saveInternalNotes}>
          حفظ الملاحظات
        </Button>
      </div>
    </div>
  );
};

export default CustomerInfo;
