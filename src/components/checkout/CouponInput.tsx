import { useState, useEffect, useRef } from "react";
import { Tag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppliedCoupon, validateCoupon } from "@/services/couponService";

export type { AppliedCoupon };

interface CouponInputProps {
  ownerId: string;
  storeSlug?: string;
  subtotal: number;
  appliedCoupon: AppliedCoupon | null;
  onApply: (coupon: AppliedCoupon | null) => void;
}

const CouponInput = ({ ownerId, storeSlug, subtotal, appliedCoupon, onApply }: CouponInputProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastSubtotalRef = useRef(subtotal);

  useEffect(() => {
    if (!appliedCoupon || subtotal === lastSubtotalRef.current) {
      lastSubtotalRef.current = subtotal;
      return;
    }
    lastSubtotalRef.current = subtotal;

    const revalidate = async () => {
      setLoading(true);
      try {
        const result = await validateCoupon(ownerId, appliedCoupon.code, subtotal, storeSlug);
        if (!result) {
          onApply(null);
          setError("كود الخصم لم يعد ينطبق على المجموع الحالي");
        } else {
          onApply(result);
        }
      } catch {
        onApply(null);
      } finally {
        setLoading(false);
      }
    };

    revalidate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, appliedCoupon?.code, ownerId, storeSlug]);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed || !ownerId) return;

    setLoading(true);
    setError("");

    try {
      const result = await validateCoupon(ownerId, trimmed, subtotal, storeSlug);
      if (!result) {
        setError("كود الخصم غير صالح أو منتهي");
        onApply(null);
        return;
      }

      onApply(result);
      setError("");
    } catch {
      setError("تعذر التحقق من الكوبون");
      onApply(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode("");
    setError("");
    onApply(null);
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-3">
        <Button type="button" variant="ghost" size="icon" onClick={handleRemove} aria-label="إزالة كود الخصم" className="min-h-[44px] min-w-[44px]">
          <X className="w-4 h-4" />
        </Button>
        <div className="text-right flex-1 mr-2">
          <p className="text-sm font-bold text-primary">{appliedCoupon.code}</p>
          <p className="text-xs text-muted-foreground">
            خصم {appliedCoupon.discountAmount.toLocaleString()} د.ع
          </p>
        </div>
        <Tag className="w-4 h-4 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="rounded-xl shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "تطبيق"}
        </Button>
        <Input
          placeholder="كود الخصم"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApply())}
          className="text-right rounded-xl"
        />
      </div>
      {error && <p className="text-xs text-destructive text-right">{error}</p>}
    </div>
  );
};

export default CouponInput;
