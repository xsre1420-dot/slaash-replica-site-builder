import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Image, Type, Tag, DollarSign, Package, Palette, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useState, useEffect, useCallback, useMemo } from "react";
import { addProduct } from "@/services/productService";
import { useToast } from "@/hooks/use-toast";
import { Product, Category, ColorOption, ProductVariant } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";
import SizesManager from "@/components/SizesManager";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import CategoryDialog from "@/components/CategoryDialog";
import { formatPriceInput, isValidPrice, convertArabicToEnglish } from "@/utils/numberUtils";
import { supabase } from "@/integrations/supabase/client";
import { validateProductImages } from "@/utils/imageValidator";
import ProductFormProgress from "@/components/add-product/ProductFormProgress";
import ProductPreviewCard from "@/components/add-product/ProductPreviewCard";
import FormSection from "@/components/add-product/FormSection";

const AddProduct = () => {
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [stockQuantity, setStockQuantity] = useState("");
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  // --- Validation ---
  const validateField = useCallback((field: string, value: string) => {
    setFieldErrors(prev => {
      const next = { ...prev };
      if (field === "name" && !value.trim()) next.name = "اسم المنتج مطلوب";
      else if (field === "name") delete next.name;

      if (field === "price" && (!value || !isValidPrice(value))) next.price = "سعر صحيح مطلوب";
      else if (field === "price") delete next.price;

      return next;
    });
  }, []);

  // --- Progress (required fields only for completion %) ---
  const progressSteps = useMemo(() => [
    { label: "صورة المنتج", icon: <Image className="w-3.5 h-3.5" />, completed: !!mainImage, required: true },
    { label: "اسم المنتج", icon: <Type className="w-3.5 h-3.5" />, completed: !!name.trim(), required: true },
    { label: "الفئة", icon: <Tag className="w-3.5 h-3.5" />, completed: !!category, required: true },
    { label: "السعر", icon: <DollarSign className="w-3.5 h-3.5" />, completed: !!price && isValidPrice(price), required: true },
    { label: "الكمية", icon: <Package className="w-3.5 h-3.5" />, completed: !!stockQuantity, required: false },
    { label: "القياسات والألوان", icon: <Palette className="w-3.5 h-3.5" />, completed: colors.length > 0 || sizes.length > 0, required: false },
  ], [mainImage, name, category, price, stockQuantity, colors, sizes]);

  const completionPercentage = useMemo(() => {
    const required = progressSteps.filter(s => s.required !== false);
    const done = required.filter(s => s.completed).length;
    return Math.round((done / required.length) * 100);
  }, [progressSteps]);

  const scrollToFirstError = (errors: Record<string, string>) => {
    const order = ['image', 'name', 'category', 'price'];
    const first = order.find(k => errors[k]);
    if (!first) return;
    const el = document.getElementById(first === 'image' ? 'product-images' : first);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // --- Variants ---
  useEffect(() => {
    if (colors.length === 0 && sizes.length === 0) { setVariants([]); return; }
    setVariants(prev => {
      const newVariants: ProductVariant[] = [];
      if (colors.length > 0 && sizes.length > 0) {
        colors.forEach(color => sizes.forEach(size => {
          const ex = prev.find(v => v.color === color.value && v.size === size);
          newVariants.push({ color: color.value, size, quantity: ex?.quantity || 0 });
        }));
      } else if (colors.length > 0) {
        colors.forEach(color => {
          const ex = prev.find(v => v.color === color.value && !v.size);
          newVariants.push({ color: color.value, quantity: ex?.quantity || 0 });
        });
      } else {
        sizes.forEach(size => {
          const ex = prev.find(v => v.size === size && !v.color);
          newVariants.push({ size, quantity: ex?.quantity || 0 });
        });
      }
      return newVariants;
    });
  }, [colors, sizes]);

  const handleVariantQuantityChange = (index: number, rawValue: string) => {
    const cleaned = convertArabicToEnglish(rawValue).replace(/[^\d]/g, '');
    const quantity = parseInt(cleaned) || 0;
    const updated = [...variants];
    updated[index].quantity = quantity;
    setVariants(updated);
  };

  // Auto-calculate total stock from variants
  const totalVariantStock = useMemo(() => {
    if (variants.length === 0) return 0;
    return variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
  }, [variants]);

  useEffect(() => {
    if (variants.length > 0) {
      setStockQuantity(String(totalVariantStock));
    }
  }, [totalVariantStock, variants.length]);

  // --- Categories ---
  const loadCategories = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('categories').select('*').eq('owner_id', user.id).order('display_order', { ascending: true });
      if (error) throw error;
      setCategories(data.map(cat => ({ id: cat.id, name: cat.name, order: cat.display_order })));
    } catch { console.warn('Using local categories fallback'); }
  }, []);

  useEffect(() => {
    loadCategories();
    const handleFocus = () => loadCategories();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadCategories]);

  // --- Handlers ---
  const handleImagesChange = (newMain: string | null, newAdditional: string[]) => {
    setMainImage(newMain);
    setAdditionalImages(newAdditional);
    if (newMain) setFieldErrors(p => { const n = { ...p }; delete n.image; return n; });
  };

  const handlePriceChange = (v: string) => { const f = formatPriceInput(v); setPrice(f); validateField("price", f); };
  const handleCostChange = (v: string) => setCost(formatPriceInput(v));
  const handleStockChange = (v: string) => setStockQuantity(convertArabicToEnglish(v).replace(/[^\d]/g, ''));

  const formatDisplayPrice = (p: string): string => {
    if (!p) return '';
    const n = parseFloat(p.replace(/,/g, ''));
    if (isNaN(n) || n === 0) return '';
    return n.toLocaleString('en-US');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast({ title: "خطأ", description: "يجب تسجيل الدخول أولاً", variant: "destructive" }); return; }

    const errors: Record<string, string> = {};
    if (!mainImage) errors.image = "أضف صورة رئيسية — العملاء يحتاجون لرؤية المنتج";
    if (!name.trim()) errors.name = "اسم المنتج مطلوب — مثال: قميص قطني أبيض";
    if (!category) errors.category = categories.length === 0
      ? "أنشئ فئة أولاً بالضغط على + بجانب القائمة"
      : "اختر فئة لتسهيل تصفّح العملاء للمنتج";
    if (!price || !isValidPrice(price)) errors.price = "أدخل سعراً صحيحاً أكبر من صفر";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      scrollToFirstError(errors);
      toast({
        title: "يرجى إكمال الحقول المطلوبة",
        description: `${Object.keys(errors).length} حقول تحتاج انتباهك`,
        variant: "destructive",
      });
      return;
    }

    // Suggestion #1: Validate image URLs before saving
    const imageValidation = await validateProductImages(mainImage, additionalImages);
    if (imageValidation.hasBlobUrls) {
      toast({ title: "خطأ في الصور", description: "بعض الصور لم تُرفع بعد. انتظر اكتمال الرفع.", variant: "destructive" });
      return;
    }
    if (!imageValidation.valid) {
      toast({ title: "تحذير", description: `${imageValidation.invalidUrls.length} صورة غير صالحة. يرجى إعادة رفعها.`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const numericPrice = parseFloat(price.replace(/,/g, ''));
      const numericCost = cost ? parseFloat(cost.replace(/,/g, '')) : undefined;
      const newProduct: Product = {
        id: '',
        name: name.trim(),
        description: description.trim(),
        category,
        price: numericPrice,
        cost: numericCost,
        image: mainImage!,
        additionalImages,
        sizes: sizes.length > 0 ? sizes : undefined,
        colors: colors.length > 0 ? colors : undefined,
        stockQuantity: stockQuantity ? parseInt(stockQuantity) : 0,
        variants: variants.length > 0 ? variants : undefined,
      };

      const result = await addProduct(newProduct);
      if (result.success) {
        toast({ title: "تم بنجاح", description: "تمت إضافة المنتج — يمكن للعملاء رؤيته الآن" });
        navigate('/products');
      } else {
        toast({ title: "خطأ", description: result.error || "فشل في إضافة المنتج", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error adding product:', error);
      toast({ title: "خطأ", description: "فشل في إضافة المنتج — تحقق من اتصالك وحاول مجدداً", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="إضافة منتج جديد"
        description="4 حقول مطلوبة فقط: صورة، اسم، فئة، وسعر — الباقي اختياري"
        backTo="/products"
        backLabel="العودة للمنتجات"
        breadcrumbs={[{ label: 'المنتجات', href: '/products' }, { label: 'إضافة منتج' }]}
        actions={
          <Button
            type="submit"
            form="add-product-form"
            disabled={isSubmitting}
            className="rounded-xl gap-1.5 min-h-[44px] shadow-brand"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "جاري الحفظ..." : "حفظ المنتج"}
          </Button>
        }
      />

      <div className="ds-page max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: Progress + Preview */}
          <div className="lg:col-span-1 space-y-5 order-first lg:order-last">
            <div className="lg:sticky lg:top-20 space-y-5">
              <ProductFormProgress steps={progressSteps} completionPercentage={completionPercentage} />
              <ProductPreviewCard name={name} price={price} image={mainImage} category={category} />
            </div>
          </div>

          {/* Main form */}
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">نصيحة:</strong> ابدأ بالحقول المطلوبة (★) — يمكنك إضافة الوصف والمخزون لاحقاً من صفحة التعديل.
            </div>

            <form id="add-product-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Images */}
              <FormSection icon={<Image className="w-4 h-4" />} title="صور المنتج ★">
                <div id="product-images">
                  <ProductImagesManager mainImage={mainImage} additionalImages={additionalImages} onImagesChange={handleImagesChange} />
                </div>
                {fieldErrors.image && <p className="text-destructive text-xs mt-2" role="alert">{fieldErrors.image}</p>}
                {!fieldErrors.image && !mainImage && (
                  <p className="text-xs text-muted-foreground mt-2">ارفع صورة واضحة — أول ما يراه العميل</p>
                )}
              </FormSection>

              {/* Basic Info */}
              <FormSection icon={<Type className="w-4 h-4" />} title="المعلومات الأساسية">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground text-right block">اسم المنتج ★</Label>
                    <Input
                      id="name"
                      className={`text-right ds-input ${fieldErrors.name ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                      value={name}
                      onChange={(e) => { setName(e.target.value); validateField("name", e.target.value); }}
                      placeholder="مثال: ساعة ذكية سوداء"
                      aria-invalid={!!fieldErrors.name}
                      aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                    />
                    {fieldErrors.name && <p id="name-error" className="text-destructive text-xs" role="alert">{fieldErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-foreground text-right block">الفئة ★</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryDialogOpen(true)} className="rounded-xl border-border hover:bg-accent flex-shrink-0" aria-label="إضافة فئة جديدة">
                        <Plus className="w-4 h-4 text-primary" />
                      </Button>
                      <Select value={category} onValueChange={(v) => { setCategory(v); setFieldErrors(p => { const n = { ...p }; delete n.category; return n; }); }}>
                        <SelectTrigger id="category" className={`w-full text-right ds-input ${fieldErrors.category ? 'border-destructive' : ''}`}>
                          <SelectValue placeholder={categories.length === 0 ? 'أنشئ فئة أولاً' : 'اختر فئة'} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.name} className="text-right">{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {fieldErrors.category && <p className="text-destructive text-xs" role="alert">{fieldErrors.category}</p>}
                    {categories.length === 0 && !fieldErrors.category && (
                      <p className="text-xs text-muted-foreground">لا توجد فئات — اضغط + لإنشاء فئة مثل "ملابس" أو "إلكترونيات"</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-foreground text-right block">الوصف</Label>
                  <Textarea
                    id="description"
                    className="text-right rounded-xl border-border min-h-[100px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="أدخل وصف المنتج"
                  />
                </div>
              </FormSection>

              {/* Pricing */}
              <FormSection icon={<DollarSign className="w-4 h-4" />} title="التسعير">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-foreground text-right block">سعر البيع (د.ع) ★</Label>
                    <Input
                      id="price"
                      type="text"
                      inputMode="numeric"
                      className={`text-right ds-input ${fieldErrors.price ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                      value={formatDisplayPrice(price)}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      placeholder="مثال: 25,000"
                      aria-invalid={!!fieldErrors.price}
                    />
                    {fieldErrors.price && <p className="text-destructive text-xs" role="alert">{fieldErrors.price}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost" className="text-foreground text-right block">التكلفة (د.ع) - اختياري</Label>
                    <Input
                      id="cost"
                      type="text"
                      className="text-right rounded-xl border-border"
                      value={formatDisplayPrice(cost)}
                      onChange={(e) => handleCostChange(e.target.value)}
                      placeholder="أدخل التكلفة"
                    />
                  </div>
                </div>
              </FormSection>

              {/* Stock */}
              <FormSection icon={<Package className="w-4 h-4" />} title="المخزون (اختياري)">
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity" className="text-foreground text-right block">الكمية الإجمالية</Label>
                  <Input
                    id="stockQuantity"
                    type="text"
                    inputMode="numeric"
                    className="text-right rounded-xl border-border"
                    value={stockQuantity}
                    onChange={(e) => handleStockChange(e.target.value)}
                    disabled={variants.length > 0}
                    placeholder="أدخل الكمية المتاحة"
                  />
                  {variants.length > 0 && (
                    <p className="text-xs text-muted-foreground text-right">
                      يتم حساب الكمية تلقائياً من مجموع كميات المتغيرات ({totalVariantStock})
                    </p>
                  )}
                </div>
              </FormSection>

              {/* Sizes & Colors */}
              <FormSection icon={<Palette className="w-4 h-4" />} title="القياسات والألوان (اختياري)">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-muted rounded-xl p-4">
                    <SizesManager sizes={sizes} onSizesChange={setSizes} />
                  </div>
                  <div className="bg-muted rounded-xl p-4">
                    <ColorSwatchPicker colors={colors} onColorsChange={setColors} />
                  </div>
                </div>

                {variants.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-foreground bg-muted px-3 py-1 rounded-lg">
                        المجموع: {totalVariantStock}
                      </span>
                      <Label className="text-foreground text-right font-medium">كميات المتغيرات</Label>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {variants.map((variant, index) => (
                        <div key={index} className="p-3 border border-border rounded-xl bg-card flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            {variant.color && (
                              <div className="w-6 h-6 rounded-full border-2 border-border shadow-sm" style={{ backgroundColor: variant.color }} />
                            )}
                            <span className="text-sm font-medium text-foreground">
                              {variant.size || ''}
                            </span>
                          </div>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={variant.quantity || ''}
                            onChange={(e) => handleVariantQuantityChange(index, e.target.value)}
                            className="text-center rounded-xl border-border h-9 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </FormSection>

              {/* Mobile submit */}
              <div className="flex justify-center pt-4 lg:hidden">
                <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-primary text-primary-foreground py-5 text-base gap-2">
                  <Save className="w-4 h-4" />
                  {isSubmitting ? "جاري الحفظ..." : "إضافة المنتج"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <CategoryDialog
        categories={categories}
        onCategoryChange={loadCategories}
        onAddLocalCategory={(cat) => setCategories(prev => [...prev, cat])}
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
      />
    </DashboardLayout>
  );
};

export default AddProduct;
