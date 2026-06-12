import { useState } from "react";
import { Truck, Package, MapPin, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { OrderShipmentData } from "@/services/deliveryService";
import {
  updateShipmentStatus,
  markDeliveryFailed,
  retryFailedDelivery,
} from "@/services/deliveryService";
import {
  DELIVERY_STATUS_OPTIONS,
  getDeliveryStatusLabel,
  DeliveryStatus,
} from "@/utils/deliveryUtils";
import { toast } from "sonner";

interface OrderShipmentCardProps {
  data: OrderShipmentData;
  onUpdated: () => void;
}

const OrderShipmentCard = ({ data, onUpdated }: OrderShipmentCardProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState(data.shipment?.tracking_number || '');
  const [carrier, setCarrier] = useState(data.shipment?.carrier || 'internal');
  const [status, setStatus] = useState<DeliveryStatus>(data.deliveryStatus);
  const [failReason, setFailReason] = useState('');

  const shipmentId = data.shipment?.id;

  const handleUpdateStatus = async () => {
    if (!user?.id || !shipmentId) return;
    setLoading(true);
    const result = await updateShipmentStatus(shipmentId, user.id, status, {
      trackingNumber: trackingNumber || undefined,
      carrier: carrier || undefined,
      note: `تحديث إلى: ${getDeliveryStatusLabel(status)}`,
    });
    setLoading(false);
    if (result.success) {
      toast.success('تم تحديث حالة الشحنة');
      onUpdated();
    } else {
      toast.error(result.error || 'فشل التحديث');
    }
  };

  const handleMarkFailed = async () => {
    if (!user?.id || !shipmentId) return;
    setLoading(true);
    const result = await markDeliveryFailed(shipmentId, user.id, failReason || 'فشل التوصيل');
    setLoading(false);
    if (result.success) {
      toast.success('تم تسجيل فشل التوصيل');
      onUpdated();
    } else {
      toast.error(result.error || 'فشل التسجيل');
    }
  };

  const handleRetry = async () => {
    if (!user?.id || !shipmentId) return;
    setLoading(true);
    const result = await retryFailedDelivery(shipmentId, user.id);
    setLoading(false);
    if (result.success) {
      toast.success('تم جدولة إعادة التوصيل');
      onUpdated();
    } else {
      toast.error(result.error || 'فشلت إعادة المحاولة');
    }
  };

  return (
    <div className="bg-muted rounded-2xl p-6">
      <div className="flex items-center gap-2 justify-end mb-4">
        <h3 className="text-lg font-semibold text-foreground">الشحن والتوصيل</h3>
        <Truck className="w-5 h-5 text-primary" />
      </div>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="font-medium">{getDeliveryStatusLabel(data.deliveryStatus)}</span>
          <span className="text-muted-foreground">حالة التوصيل</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">{data.deliveryFee.toLocaleString()} د.ع</span>
          <span className="text-muted-foreground">رسوم التوصيل</span>
        </div>
        {data.shipment?.governorate && (
          <div className="flex justify-between">
            <span className="font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {data.shipment.governorate}
            </span>
            <span className="text-muted-foreground">المحافظة</span>
          </div>
        )}
        {data.shipment?.tracking_number && (
          <div className="flex justify-between">
            <span className="font-medium font-mono text-xs" dir="ltr">{data.shipment.tracking_number}</span>
            <span className="text-muted-foreground">رقم التتبع</span>
          </div>
        )}
        {data.shipment?.failed_reason && (
          <div className="flex justify-between text-destructive">
            <span>{data.shipment.failed_reason}</span>
            <span>سبب الفشل</span>
          </div>
        )}
      </div>

      {data.events.length > 0 && (
        <div className="mb-4 pt-3 border-t border-border/50">
          <p className="text-xs font-semibold text-muted-foreground mb-2 text-right">سجل التتبع</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {data.events.map((ev) => (
              <div key={ev.id} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                <span className="text-muted-foreground">
                  {new Date(ev.created_at).toLocaleString('ar-IQ')}
                </span>
                <span className="text-right">
                  <span className="font-medium">{getDeliveryStatusLabel(ev.status)}</span>
                  {ev.note && <span className="text-muted-foreground block">{ev.note}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {shipmentId && (
        <div className="space-y-3 pt-3 border-t border-border/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">رقم التتبع</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="TRK-..."
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-xs">شركة الشحن</Label>
              <Input
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="internal"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">تحديث الحالة</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as DeliveryStatus)}>
              <SelectTrigger className="rounded-xl mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleUpdateStatus} disabled={loading} className="w-full rounded-xl gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            حفظ تحديث الشحنة
          </Button>

          {data.deliveryStatus !== 'failed' && (
            <div className="space-y-2">
              <Textarea
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="سبب فشل التوصيل (اختياري)"
                className="rounded-xl text-sm"
              />
              <Button
                variant="outline"
                onClick={handleMarkFailed}
                disabled={loading}
                className="w-full rounded-xl gap-2 text-destructive border-destructive/30"
              >
                <AlertTriangle className="w-4 h-4" />
                تسجيل فشل التوصيل
              </Button>
            </div>
          )}

          {data.deliveryStatus === 'failed' && (
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={loading}
              className="w-full rounded-xl gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة محاولة التوصيل
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderShipmentCard;
