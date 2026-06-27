import { useState } from "react";
import { CreditCard, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Order } from "@/types";
import { OrderPaymentSummary, recordOrderRefund, recordOrderChargeback } from "@/services/paymentService";
import { getPaymentMethodLabel, getPaymentStatusLabel } from "@/utils/paymentUtils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface OrderPaymentCardProps {
  order: Order;
  summary: OrderPaymentSummary;
  onUpdated: () => void;
}

const OrderPaymentCard = ({ order, summary, onUpdated }: OrderPaymentCardProps) => {
  const { user } = useAuth();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRefund = async () => {
    if (!user?.id) return;
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صالحاً");
      return;
    }
    if (amount > summary.remainingRefundable) {
      toast.error(`الحد الأقصى للاسترداد: ${summary.remainingRefundable.toLocaleString()} د.ع`);
      return;
    }

    setLoading(true);
    const result = await recordOrderRefund(order.id, user.id, amount, refundReason || undefined);
    setLoading(false);

    if (result.success) {
      toast.success("تم تسجيل الاسترداد");
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      onUpdated();
    } else {
      toast.error(result.error || "فشل تسجيل الاسترداد");
    }
  };

  const handleChargeback = async () => {
    if (!user?.id) return;
    if (!confirm("تسجيل نزاع (chargeback) على هذا الطلب؟")) return;

    setLoading(true);
    const result = await recordOrderChargeback(
      order.id,
      user.id,
      summary.totalAmount - summary.refundedTotal,
      'تسجيل نزاع من التاجر'
    );
    setLoading(false);

    if (result.success) {
      toast.success("تم تسجيل النزاع");
      onUpdated();
    } else {
      toast.error(result.error || "فشل تسجيل النزاع");
    }
  };

  return (
    <div className="bg-muted rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground text-right flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          الدفع والاسترداد
        </h3>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="font-medium">{getPaymentMethodLabel(summary.paymentMethod)}</span>
          <span className="text-muted-foreground">طريقة الدفع</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">{getPaymentStatusLabel(summary.paymentStatus)}</span>
          <span className="text-muted-foreground">حالة الدفع</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">{summary.totalAmount.toLocaleString()} د.ع</span>
          <span className="text-muted-foreground">إجمالي الطلب</span>
        </div>
        {summary.refundedTotal > 0 && (
          <div className="flex justify-between text-primary">
            <span className="font-medium">-{summary.refundedTotal.toLocaleString()} د.ع</span>
            <span>المسترد</span>
          </div>
        )}
        {summary.remainingRefundable > 0 && summary.orderStatus === 'completed' && (
          <div className="flex justify-between">
            <span className="font-medium">{summary.remainingRefundable.toLocaleString()} د.ع</span>
            <span className="text-muted-foreground">قابل للاسترداد</span>
          </div>
        )}
      </div>

      {summary.orderStatus === 'completed' && summary.remainingRefundable > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1"
            onClick={() => {
              setRefundAmount(String(summary.remainingRefundable));
              setRefundOpen(true);
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            تسجيل استرداد
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1 text-amber-600 border-amber-300"
            onClick={handleChargeback}
            disabled={loading}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            تسجيل نزاع
          </Button>
        </div>
      )}

      {summary.refunds.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-xs font-semibold text-muted-foreground mb-2 text-right">سجل الاستردادات</p>
          {summary.refunds.map((r) => (
            <div key={String(r.id)} className="flex justify-between text-xs py-1">
              <span>{Number(r.amount).toLocaleString()} د.ع</span>
              <span className="text-muted-foreground">{String(r.reason || 'استرداد')}</span>
            </div>
          ))}
        </div>
      )}

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-right">تسجيل استرداد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>المبلغ (د.ع)</Label>
              <Input
                type="number"
                min={0}
                max={summary.remainingRefundable}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label>السبب (اختياري)</Label>
              <Input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="سبب الاسترداد"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRefund} disabled={loading} className="rounded-xl w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الاسترداد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderPaymentCard;
