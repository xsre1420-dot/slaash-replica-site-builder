import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Image, Type, Tag, DollarSign, Package, Palette, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { addProduct } from "@/data/dummyData";
import { useToast } from "@/hooks/use-toast";
import { Product, Category, ColorOption, ProductVariant } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";
import SizesManager from "@/components/SizesManager";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import CategoryDialog from "@/components/CategoryDialog";
import { formatPriceInput, isValidPrice } from "@/utils/numberUtils";
import { supabase } from "@/integrations/supabase/client";
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

  // --- Progress ---
  const progressSteps = useMemo(() => [
    { label: "الصورة", icon: <Image className="w-3.5 h-3.5" />, completed: !!mainImage },
    { label: "الاسم", icon: <Type className="w-3.5 h-3.5" />, completed: !!name.trim() },
    { label: "الفئة", icon: <Tag className="w-3.5 h-3.5" />, completed: !!category },
    { label: "السعر", icon: <DollarSign className="w-3.5 h-3.5" />, completed: !!price && isValidPrice(price) },
    { label: "الكمية", icon: <Package className="w-3.5 h-3.5" />, completed: !!stockQuantity },
    { label: "الألوان/القياسات", icon: <Palette className="w-3.5 h-3.5" />, completed: colors.length > 0 || sizes.length > 0 },
  ], [mainImage, name, category, price, stockQuantity, colors, sizes]);

  const completionPercentage = useMemo(() => {
    const done = progressSteps.filter(s => s.completed).length;
    return Math.round((done / progressSteps.length) * 100);
  }, [progressSteps]);

  // --- Variants ---
  const updateVariants = useCallback(() => {
    if (colors.length === 0 && sizes.length === 0) { setVariants([]); return; }
    const newVariants: ProductVariant[] = [];
    if (colors.length > 0 && sizes.length > 0) {
      colors.forEach(color => sizes.forEach(size => {
        const ex = variants.find(v => v.color === color.value && v.size === size);
        newVariants.push({ color: color.value, size, quantity: ex?.quantity || 0 });
      }));
    } else if (colors.length > 0) {
      colors.forEach(color => {
        const ex = variants.find(v => v.color === color.value && !v.size);
        newVariants.push({ color: color.value, quantity: ex?.quantity || 0 });
      });
    } else {
      sizes.forEach(size => {
        const ex = variants.find(v => v.size === size && !v.color);
        newVariants.push({ size, quantity: ex?.quantity || 0 });
      });
    }
    setVariants(newVariants);
  }, [colors, sizes, variants]);

  useEffect(() => { updateVariants(); }, [colors, sizes]);

  const handleVariantQuantityChange = (index: number, quantity: number) => {
    const updated = [...variants];
    updated[index].quantity = quantity;
    setVariants(updated);
  };

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
  };

  const handlePriceChange = (v: string) => { const f = formatPriceInput(v); setPrice(f); validateField("price", f); };
  const handleCostChange = (v: string) => setCost(formatPriceInput(v));

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
    if (!name.trim()) errors.name = "اسم المنتج مطلوب";
    if (!category) errors.category = "اختر فئة المنتج";
    if (!price || !isValidPrice(price)) errors.price = "سعر صحيح مطلوب";
    if (!mainImage) errors.image = "أضف صورة رئيسية";
    if (Object.keys(errors).length) { setFieldErrors(errors); toast({ title: "تحقق من البيانات", description: "يرجى ملء الحقول المطلوبة", variant: "destructive" }); return; }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('products').insert([{
        owner_id: user.id, name: name.trim(), description: description.trim(), category,
        price: Number(formatPriceInput(price)), cost: cost ? Number(formatPriceInput(cost)) : null,
        image_url: mainImage, additional_images: additionalImages.length > 0 ? additionalImages : null,
        sizes: sizes.length > 0 ? sizes : null, colors: colors.length > 0 ? JSON.stringify(colors) : null,
        stock_quantity: stockQuantity ? parseInt(stockQuantity) : 0,
        variants: variants.length > 0 ? JSON.stringify(variants) : null,
      }]);
      if (error) throw error;
      toast({ title: "تم بنجاح", description: "تمت إضافة منتج جديد" });
      navigate('/products');
    } catch (error) {
      console.error('Error adding product:', error);
      toast({ title: "خطأ", description: "فشل في إضافة المنتج", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-arabic">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted">
                <X className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-foreground">إضافة منتج جديد</h1>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
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
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Images */}
              <FormSection icon={<Image className="w-4 h-4" />} title="صور المنتج">
                <ProductImagesManager mainImage={mainImage} additionalImages={additionalImages} onImagesChange={handleImagesChange} />
                {fieldErrors.image && <p className="text-destructive text-xs mt-1">{fieldErrors.image}</p>}
              </FormSection>

              {/* Basic Info */}
              <FormSection icon={<Type className="w-4 h-4" />} title="المعلومات الأساسية">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground text-right block">اسم المنتج *</Label>
                    <Input
                      id="name"
                      className={`text-right rounded-xl border-border focus:border-ring ${fieldErrors.name ? 'border-destructive' : ''}`}
                      value={name}
                      onChange={(e) => { setName(e.target.value); validateField("name", e.target.value); }}
                      placeholder="أدخل اسم المنتج"
                    />
                    {fieldErrors.name && <p className="text-destructive text-xs">{fieldErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-foreground text-right block">الفئة *</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryDialogOpen(true)} className="rounded-xl border-border hover:bg-accent flex-shrink-0">
                        <Plus className="w-4 h-4 text-primary" />
                      </Button>
                      <Select value={category} onValueChange={(v) => { setCategory(v); setFieldErrors(p => { const n = { ...p }; delete n.category; return n; }); }}>
                        <SelectTrigger className={`w-full text-right rounded-xl border-border ${fieldErrors.category ? 'border-destructive' : ''}`}>
                          <SelectValue placeholder="اختر فئة" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.name} className="text-right">{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {fieldErrors.category && <p className="text-destructive text-xs">{fieldErrors.category}</p>}
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
                    <Label htmlFor="price" className="text-foreground text-right block">سعر البيع (د.ع) *</Label>
                    <Input
                      id="price"
                      type="text"
                      className={`text-right rounded-xl border-border ${fieldErrors.price ? 'border-destructive' : ''}`}
                      value={formatDisplayPrice(price)}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      placeholder="أدخل سعر البيع"
                    />
                    {fieldErrors.price && <p className="text-destructive text-xs">{fieldErrors.price}</p>}
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
              <FormSection icon={<Package className="w-4 h-4" />} title="المخزون">
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity" className="text-foreground text-right block">الكمية الإجمالية</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    className="text-right rounded-xl border-border"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    placeholder="أدخل الكمية المتاحة"
                    min="0"
                  />
                </div>
              </FormSection>

              {/* Sizes & Colors */}
              <FormSection icon={<Palette className="w-4 h-4" />} title="القياسات والألوان">
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
                    <Label className="text-foreground text-right block font-medium">كميات المتغيرات</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {variants.map((variant, index) => (
                        <div key={index} className="p-3 border border-border rounded-xl bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {variant.color && (
                                <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: variant.color }} />
                              )}
                              <span className="text-sm text-foreground">
                                {variant.color && variant.size ? variant.size : variant.color ? 'لون' : variant.size}
                              </span>
                            </div>
                          </div>
                          <Input
                            type="number"
                            placeholder="الكمية"
                            value={variant.quantity}
                            onChange={(e) => handleVariantQuantityChange(index, parseInt(e.target.value) || 0)}
                            className="text-right rounded-xl border-border"
                            min="0"
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
    </div>
  );
};

export default AddProduct;
