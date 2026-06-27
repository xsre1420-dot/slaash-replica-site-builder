
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Product } from "@/types";
import { updateProduct, fetchProductById } from "@/services/productService";
import { mapProductInsertError } from "@/lib/productUpdateUtils";
import { restockProduct, InventoryRestockError } from "@/services/inventoryService";
import { getProductLifecycleStatus } from "@/lib/productLifecycle";

interface QuickEditDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export const QuickEditDialog = ({ product, open, onOpenChange, onSaved }: QuickEditDialogProps) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stockAdd, setStockAdd] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && product) {
      setName(product.name);
      setPrice(String(product.price));
      setStockAdd("");
      setCost(String(product.cost ?? ""));
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!product || !user) return;
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0) {
      toast.error("يرجى إدخال بيانات صالحة");
      return;
    }

    setSaving(true);
    const addQty = parseInt(stockAdd, 10) || 0;

    const metadataChanged =
      name.trim() !== product.name ||
      priceNum !== product.price ||
      (cost ? parseFloat(cost) || undefined : undefined) !== product.cost;

    const latest = metadataChanged ? (await fetchProductById(product.id)) ?? product : product;

    if (metadataChanged) {
      const patch: Partial<Product> = {
        name: name.trim(),
        price: priceNum,
        cost: cost ? parseFloat(cost) || undefined : undefined,
      };

      const result = await updateProduct(product.id, patch);
      if (!result.success) {
        setSaving(false);
        toast.error(mapProductInsertError(result.error || "فشل في حفظ التغييرات"));
        return;
      }
    }

    if (addQty > 0) {
      try {
        await restockProduct({
          product: {
            id: latest.id,
            name: name.trim(),
            price: priceNum,
            category: latest.category,
            image_url: latest.image,
            stock_quantity: latest.stockQuantity,
            min_stock_level: latest.lowStockThreshold,
            sizes: latest.sizes,
            colors: latest.colors,
            variants: latest.variants,
            created_at: new Date().toISOString(),
            lifecycle: getProductLifecycleStatus(latest),
          },
          ownerId: user.id,
          addAmount: addQty,
        });
      } catch (err) {
        setSaving(false);
        toast.error(
          err instanceof InventoryRestockError
            ? err.message
            : "تم حفظ البيانات لكن فشل تحديث المخزون"
        );
        return;
      }
    }

    setSaving(false);

    toast.success(addQty > 0 ? `تمت إضافة ${addQty} وحدة للمخزون` : "تم حفظ التغييرات");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-right text-base">تعديل سريع</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">اسم المنتج</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl mt-1 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">السعر</Label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="rounded-xl mt-1 text-sm" min="0" />
            </div>
            <div>
              <Label className="text-xs">التكلفة</Label>
              <Input type="number" value={cost} onChange={e => setCost(e.target.value)} className="rounded-xl mt-1 text-sm" min="0" placeholder="اختياري" />
            </div>
          </div>
          <div>
            <Label className="text-xs">المخزون الحالي</Label>
            <p className="mt-1 text-sm font-semibold tabular-nums rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
              {product?.stockQuantity ?? 0} وحدة
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              يُخصم تلقائياً عند الطلب
            </p>
          </div>
          <div>
            <Label className="text-xs">إضافة للمخزون</Label>
            <Input
              type="number"
              min="0"
              value={stockAdd}
              onChange={(e) => setStockAdd(e.target.value)}
              className="rounded-xl mt-1 text-sm"
              placeholder="0"
            />
          </div>
          <Button className="w-full rounded-xl" onClick={handleSave} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickEditDialog;
