import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { extendSubscription } from '@/services/leadAdminService';
import { toast } from 'sonner';

type ExtendSubscriptionDialogProps = {
  leadId: string;
  customerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtended?: () => void;
};

export const ExtendSubscriptionDialog = ({
  leadId,
  customerName,
  open,
  onOpenChange,
  onExtended,
}: ExtendSubscriptionDialogProps) => {
  const [months, setMonths] = useState('6');
  const [loading, setLoading] = useState(false);

  const handleExtend = async () => {
    setLoading(true);
    try {
      await extendSubscription(leadId, {
        extraMonths: Number(months),
        reason: `admin extend +${months} months`,
      });
      toast.success('تم تمديد الاشتراك');
      onOpenChange(false);
      onExtended?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'extend_failed';
      toast.error(msg === 'forbidden' ? 'غير مصرح' : 'تعذر تمديد الاشتراك');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-arabic max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            تمديد الاشتراك
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {customerName ? `تمديد اشتراك ${customerName}. ` : ''}
          يُضاف الوقت من تاريخ الانتهاء الحالي (أو من اليوم إن كان منتهياً).
        </p>
        <div className="space-y-2">
          <Label>مدة التمديد</Label>
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">شهر واحد</SelectItem>
              <SelectItem value="3">3 أشهر</SelectItem>
              <SelectItem value="6">6 أشهر</SelectItem>
              <SelectItem value="12">12 شهر</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button className="rounded-xl" disabled={loading} onClick={() => void handleExtend()}>
            {loading ? 'جاري التمديد...' : 'تمديد الاشتراك'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExtendSubscriptionDialog;
