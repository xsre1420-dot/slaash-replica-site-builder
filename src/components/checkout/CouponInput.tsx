import { useState, useEffect, useRef } from "react";
import { Tag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

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
        let data: Record<string, unknown> | null = null;
        let rpcError: { message: string } | null = null;

        if (storeSlug) {
          const res = await (supabase as any).rpc("validate_store_coupon_by_slug", {
            p_slug: storeSlug.trim().toLowerCase(),
            p_code: appliedCoupon.code,
            p_subtotal: subtotal,
          });
          data = res.data;
          rpcError = res.error;
        } else {
          const res = await (supabase as any).rpc("validate_store_coupon", {
            p_owner_id: ownerId,
            p_code: appliedCoupon.code,
            p_subtotal: subtotal,
          });
          data = res.data;
          rpcError = res.error;
        }

        if (rpcError || !data?.valid) {
          onApply(null);
          setError("كود الخصم لم يعد ينطبق على المجموع الحالي");
        } else {
          onApply({
            code: String(data.code || appliedCoupon.code),
            discountAmount: Number(data.discount_amount) || 0,
          });
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
      let data: any;
      let rpcError: any;

      if (storeSlug) {
        ({ data, error: rpcError } = await (supabase as any).rpc("validate_store_coupon_by_slug", {
          p_slug: storeSlug.trim().toLowerCase(),
          p_code: trimmed,
          p_subtotal: subtotal,
        }));
      } else {
        ({ data, error: rpcError } = await (supabase as any).rpc("validate_store_coupon", {
          p_owner_id: ownerId,
          p_code: trimmed,
          p_subtotal: subtotal,
        }));
      }

      if (rpcError || !data?.valid) {
        setError("كود الخصم غير صالح أو منتهي");
        onApply(null);
        return;
      }

      onApply({
        code: data.code || trimmed.toUpperCase(),
        discountAmount: Number(data.discount_amount) || 0,
      });
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
        <Button type="button" variant="ghost" size="icon" onClick={handleRemove} className="h-8 w-8">
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
