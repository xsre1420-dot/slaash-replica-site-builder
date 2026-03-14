
import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ParsedProduct {
  name: string;
  description: string;
  category: string;
  price: number;
  cost?: number;
  stock_quantity?: number;
  sizes?: string[];
  image_url?: string;
}

interface UploadResult {
  success: number;
  failed: number;
  errors: string[];
}

export const BulkUpload = ({ onComplete }: { onComplete: () => void }) => {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsed, setParsed] = useState<ParsedProduct[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = ["اسم المنتج", "الوصف", "التصنيف", "السعر", "التكلفة", "الكمية", "المقاسات", "رابط الصورة"];
    const example = ["قميص أبيض", "قميص قطني مريح", "ملابس", "25000", "15000", "50", "S,M,L,XL", "https://example.com/image.jpg"];
    const csv = "\uFEFF" + [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): ParsedProduct[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("الملف فارغ أو لا يحتوي على بيانات");

    const products: ParsedProduct[] = [];
    const parseErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      const name = cols[0];
      const price = parseFloat(cols[3]);

      if (!name) {
        parseErrors.push(`سطر ${i + 1}: اسم المنتج مطلوب`);
        continue;
      }
      if (isNaN(price) || price <= 0) {
        parseErrors.push(`سطر ${i + 1}: السعر غير صالح للمنتج "${name}"`);
        continue;
      }

      products.push({
        name,
        description: cols[1] || "",
        category: cols[2] || "",
        price,
        cost: cols[4] ? parseFloat(cols[4]) || undefined : undefined,
        stock_quantity: cols[5] ? parseInt(cols[5]) || 0 : 0,
        sizes: cols[6] ? cols[6].split(/[,،]/).map(s => s.trim()).filter(Boolean) : undefined,
        image_url: cols[7] || undefined,
      });
    }

    setErrors(parseErrors);
    return products;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("يرجى اختيار ملف CSV");
      return;
    }

    setParsing(true);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const products = parseCSV(evt.target?.result as string);
        setParsed(products);
        if (products.length === 0) {
          toast.error("لم يتم العثور على منتجات صالحة");
        }
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (parsed.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("يرجى تسجيل الدخول أولاً");
      return;
    }

    setUploading(true);
    setProgress(0);
    let success = 0;
    let failed = 0;
    const uploadErrors: string[] = [];

    // Batch insert in chunks of 20
    const chunkSize = 20;
    for (let i = 0; i < parsed.length; i += chunkSize) {
      const chunk = parsed.slice(i, i + chunkSize).map(p => ({
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        cost: p.cost || null,
        stock_quantity: p.stock_quantity || 0,
        sizes: p.sizes || null,
        image_url: p.image_url || null,
        owner_id: user.id,
      }));

      const { error } = await supabase.from("products").insert(chunk);
      if (error) {
        failed += chunk.length;
        uploadErrors.push(`خطأ في رفع الدفعة ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
      } else {
        success += chunk.length;
      }
      setProgress(Math.round(((i + chunkSize) / parsed.length) * 100));
    }

    setResult({ success, failed, errors: uploadErrors });
    setUploading(false);

    if (success > 0) {
      toast.success(`تم رفع ${success} منتج بنجاح`);
      onComplete();
    }
  };

  const reset = () => {
    setParsed([]);
    setErrors([]);
    setResult(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl border-border text-foreground text-xs">
          <Upload className="w-3.5 h-3.5 ml-1" />
          رفع جماعي
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">رفع منتجات جماعي (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template download */}
          <Button variant="outline" size="sm" className="w-full rounded-xl text-xs" onClick={downloadTemplate}>
            <Download className="w-3.5 h-3.5 ml-1" />
            تحميل قالب CSV
          </Button>

          {/* File input */}
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">اضغط لاختيار ملف CSV</p>
            </label>
          </div>

          {/* Parse errors */}
          {errors.length > 0 && (
            <div className="bg-destructive/10 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1 text-destructive text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                تحذيرات ({errors.length})
              </div>
              {errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-destructive/80 mr-5">{e}</p>
              ))}
              {errors.length > 5 && <p className="text-xs text-destructive/60 mr-5">و {errors.length - 5} تحذيرات أخرى...</p>}
            </div>
          )}

          {/* Parsed preview */}
          {parsed.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  <CheckCircle className="w-4 h-4 inline ml-1 text-emerald-500" />
                  {parsed.length} منتج جاهز للرفع
                </span>
                <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {parsed.slice(0, 20).map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 text-xs">
                    <span className="font-medium text-foreground truncate flex-1">{p.name}</span>
                    <span className="text-muted-foreground mr-2">{p.price.toLocaleString()} د.ع</span>
                    <span className="text-muted-foreground">{p.stock_quantity || 0} وحدة</span>
                  </div>
                ))}
                {parsed.length > 20 && (
                  <div className="p-2 text-center text-xs text-muted-foreground">و {parsed.length - 20} منتج آخر...</div>
                )}
              </div>

              {uploading && (
                <div className="space-y-1.5">
                  <Progress value={progress} className="h-2 rounded-full" />
                  <p className="text-xs text-muted-foreground text-center">جاري الرفع... {progress}%</p>
                </div>
              )}

              <Button
                className="w-full rounded-xl"
                onClick={handleUpload}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 ml-2" />
                {uploading ? "جاري الرفع..." : `رفع ${parsed.length} منتج`}
              </Button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                <CheckCircle className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                <p className="text-sm font-medium text-foreground">تم رفع {result.success} منتج بنجاح</p>
                {result.failed > 0 && <p className="text-xs text-destructive">فشل رفع {result.failed} منتج</p>}
              </div>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => { reset(); setOpen(false); }}>
                إغلاق
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUpload;
