
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types";

interface QuickEditDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export const QuickEditDialog = ({ product, open, onOpenChange, onSaved }: QuickEditDialogProps) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && product) {
      setName(product.name);
      setPrice(String(product.price));
      setStock(String(product.stockQuantity ?? 0));
      setCost(String(product.cost ?? ""));
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!product) return;
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0) {
      toast.error("يرجى إدخال بيانات صالحة");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({
        name: name.trim(),
        price: priceNum,
        stock_quantity: parseInt(stock) || 0,
        cost: cost ? parseFloat(cost) || null : null,
      })
      .eq("id", product.id);

    setSaving(false);
    if (error) {
      toast.error("فشل في حفظ التغييرات");
    } else {
      toast.success("تم حفظ التغييرات");
      onSaved();
      onOpenChange(false);
    }
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
            <Label className="text-xs">الكمية في المخزون</Label>
            <Input type="number" value={stock} onChange={e => setStock(e.target.value)} className="rounded-xl mt-1 text-sm" min="0" />
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
