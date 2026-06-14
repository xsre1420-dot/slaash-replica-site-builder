
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useState, useEffect, useRef } from "react";
import { getCategories, fetchProductById, updateProduct, deleteProduct } from "@/services/productService";
import { useStoreHydration } from "@/context/StoreBootstrapContext";
import { useToast } from "@/hooks/use-toast";
import { Product, Category, ColorOption } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";
import SizesManager from "@/components/SizesManager";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import { formatPriceInput, isValidPrice } from "@/utils/numberUtils";
import { useUndoDelete } from "@/hooks/useUndoDelete";
import { validateProductImages } from "@/utils/imageValidator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const EditProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImagesUploading, setIsImagesUploading] = useState(false);
  const loadedProductRef = useRef<Product | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isReady, hydrationVersion } = useStoreHydration();
  const [loadingProduct, setLoadingProduct] = useState(true);

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      const cats = await getCategories();
      setCategories(cats);
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (!productId || !isReady) return;

    const loadProduct = async () => {
      setLoadingProduct(true);
      const product = await fetchProductById(productId);
      if (product) {
        loadedProductRef.current = product;
        setName(product.name);
        setDescription(product.description);
        setCategory(product.category);
        setPrice(product.price > 0 ? product.price.toString() : '');
        setMainImage(product.image);
        setAdditionalImages(product.additionalImages || []);
        setSizes(product.sizes || []);
        setColors(product.colors || []);
      } else {
        toast({
          title: "خطأ",
          description: "المنتج غير موجود",
          variant: "destructive"
        });
        navigate('/products');
      }
      setLoadingProduct(false);
    };

    loadProduct();
  }, [productId, isReady, hydrationVersion, navigate, toast]);

  if (loadingProduct) {
    return (
      <DashboardLayout>
        <PageHeader
          title="تعديل المنتج"
          description="جاري تحميل بيانات المنتج..."
          backTo="/products"
          breadcrumbs={[
            { label: 'لوحة التحكم', href: '/builder' },
            { label: 'المنتجات', href: '/products' },
            { label: 'تعديل' },
          ]}
        />
        <div className="ds-page max-w-3xl space-y-4">
          <div className="ds-card p-6 space-y-4 animate-pulse">
            <div className="h-48 bg-muted rounded-xl" />
            <div className="h-10 bg-muted rounded-xl" />
            <div className="h-10 bg-muted rounded-xl" />
            <div className="h-24 bg-muted rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const handleImagesChange = (newMainImage: string | null, newAdditionalImages: string[]) => {
    setMainImage(newMainImage);
    setAdditionalImages(newAdditionalImages);
  };

  const handlePriceChange = (inputValue: string) => {
    // Convert Arabic numerics to English and format
    const formattedValue = formatPriceInput(inputValue);
    setPrice(formattedValue);
  };

  const formatDisplayPrice = (priceValue: string): string => {
    if (!priceValue) return '';
    const numericValue = parseFloat(priceValue.replace(/,/g, ''));
    if (isNaN(numericValue) || numericValue === 0) return '';
    return numericValue.toLocaleString('en-US');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "اسم المنتج مطلوب";
    if (!category) errors.category = "يرجى اختيار فئة المنتج";
    if (!price || !isValidPrice(price)) errors.price = "يرجى إدخال سعر صحيح";
    if (!mainImage) errors.image = "يرجى إضافة صورة رئيسية للمنتج";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast({
        title: "يرجى تصحيح الأخطاء",
        description: "تحقق من الحقول المحددة أدناه",
        variant: "destructive",
      });
      return;
    }

    if (isImagesUploading) {
      toast({ title: 'انتظر اكتمال رفع الصور', variant: 'destructive' });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    if (productId) {
      const imageValidation = await validateProductImages(mainImage, additionalImages);
      if (!imageValidation.valid) {
        const msg = imageValidation.hasBlobUrls
          ? 'يجب رفع الصور قبل الحفظ — لا يمكن حفظ صور مؤقتة'
          : 'بعض روابط الصور غير صالحة';
        toast({ title: "خطأ في الصور", description: msg, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const updatedProduct: Partial<Product> = {
        name,
        description,
        category,
        price: Number(formatPriceInput(price)),
        image: mainImage,
        additionalImages,
        sizes: sizes.length > 0 ? sizes : undefined,
        colors: colors.length > 0 ? colors : undefined,
      };

      const result = await updateProduct(productId, updatedProduct);

      if (result.success) {
        toast({ title: "تم بنجاح", description: "تم تحديث بيانات المنتج" });
        navigate('/products');
      } else {
        toast({ title: "خطأ", description: result.error || "فشل في تحديث المنتج", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
  };

  // Suggestion #18: Undo delete
  const { deleteWithUndo } = useUndoDelete();

  const handleDeleteProduct = async () => {
    if (!productId) return;

    const product = loadedProductRef.current ?? (await fetchProductById(productId));
    if (!product) {
      toast({ title: 'خطأ', description: 'تعذر تحميل المنتج للحذف', variant: 'destructive' });
      return;
    }

    // Remove from UI immediately
    navigate('/products');

    deleteWithUndo({
      item: product,
      itemName: product.name,
      onDelete: async () => deleteProduct(productId),
      onRestore: () => {
        toast({ title: "تم الاستعادة", description: "تم استعادة المنتج بنجاح" });
        navigate(`/edit-product/${productId}`);
      },
      timeoutMs: 5000,
    });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="تعديل المنتج"
        description={name || 'تحديث بيانات المنتج'}
        backTo="/products"
        breadcrumbs={[{ label: 'المنتجات', href: '/products' }, { label: 'تعديل' }]}
        actions={
          <Button type="submit" form="edit-product-form" disabled={isSubmitting || isImagesUploading} className="rounded-xl min-h-[44px] shadow-brand">
            <Save className="w-4 h-4" />
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        }
      />

      <div className="ds-page max-w-2xl">
        <form id="edit-product-form" className="ds-card p-6 space-y-6" onSubmit={handleSubmit}>
          {/* Image Upload */}
          <ProductImagesManager 
            mainImage={mainImage}
            additionalImages={additionalImages}
            onImagesChange={handleImagesChange}
            onUploadStateChange={setIsImagesUploading}
          />
          {fieldErrors.image && <p className="text-xs text-destructive text-right">{fieldErrors.image}</p>}

          {/* Name */}
          <div className="space-y-2 text-right">
            <Label htmlFor="name" className="block text-foreground">اسم المنتج <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              className={cn("text-right ds-input", fieldErrors.name && "border-destructive focus-visible:ring-destructive/20")}
              value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors((p) => { const n = { ...p }; delete n.name; return n; }); }}
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
          </div>

          {/* Category */}
          <div className="space-y-2 text-right">
            <Label className="block text-foreground">الفئة <span className="text-destructive">*</span></Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setFieldErrors((p) => { const n = { ...p }; delete n.category; return n; }); }}>
              <SelectTrigger className={cn("text-right ds-input", fieldErrors.category && "border-destructive")}>
                <SelectValue placeholder="اختر فئة المنتج" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.category && <p className="text-xs text-destructive">{fieldErrors.category}</p>}
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد فئات — أضف فئات من صفحة المنتجات</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2 text-right">
            <Label htmlFor="description" className="block text-foreground">الوصف</Label>
            <Textarea 
              id="description" 
              className="text-right rounded-xl border-border focus-visible:ring-primary/20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Price */}
          <div className="space-y-2 text-right">
            <Label htmlFor="price" className="block text-foreground">السعر (دينار عراقي) <span className="text-destructive">*</span></Label>
            <Input
              id="price"
              type="text"
              className={cn("text-right ds-input", fieldErrors.price && "border-destructive focus-visible:ring-destructive/20")}
              value={formatDisplayPrice(price)}
              onChange={(e) => { handlePriceChange(e.target.value); setFieldErrors((p) => { const n = { ...p }; delete n.price; return n; }); }}
              placeholder="مثال: 25,000"
            />
            {fieldErrors.price && <p className="text-xs text-destructive">{fieldErrors.price}</p>}
          </div>

          {/* Sizes Manager */}
          <SizesManager sizes={sizes} onSizesChange={setSizes} />

          {/* Colors Manager */}
          <ColorSwatchPicker colors={colors} onColorsChange={setColors} />

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              type="submit"
              disabled={isSubmitting || isImagesUploading}
              className="w-full rounded-xl min-h-[48px] shadow-brand"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button"
                  variant="destructive"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف المنتج
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-right">هل أنت متأكد من حذف هذا المنتج؟</AlertDialogTitle>
                  <AlertDialogDescription className="text-right">
                    سيتم حذف المنتج. يمكنك التراجع خلال 5 ثوانٍ بعد الحذف.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteProduct}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    نعم، احذف المنتج
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default EditProduct;
