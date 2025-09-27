import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { X, CalendarIcon, InfoIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { getCategories, addProduct, getCategoriesSync } from "@/data/dummyData";
import { useToast } from "@/hooks/use-toast";
import { Product, Category, ColorOption, ProductVariant } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";
import SizesManager from "@/components/SizesManager";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import CategoryManagement from "@/components/CategoryManagement";
import { formatPriceInput, isValidPrice } from "@/utils/numberUtils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const AddProduct = () => {
  // Basic Product Info
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
  
  // Discount Fields
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState("");
  const [discountStartDate, setDiscountStartDate] = useState<Date>();
  const [discountEndDate, setDiscountEndDate] = useState<Date>();
  
  // Advanced Features
  const [brand, setBrand] = useState("");
  const [productClassification, setProductClassification] = useState("");
  const [sku, setSku] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [additionalProducts, setAdditionalProducts] = useState<string[]>([]);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  // حساب المتغيرات عند تغيير الألوان أو القياسات
  const updateVariants = useCallback(() => {
    if (colors.length === 0 && sizes.length === 0) {
      setVariants([]);
      return;
    }

    const newVariants: ProductVariant[] = [];
    
    if (colors.length > 0 && sizes.length > 0) {
      colors.forEach(color => {
        sizes.forEach(size => {
          const existingVariant = variants.find(v => v.color === color.value && v.size === size);
          newVariants.push({
            color: color.value,
            size: size,
            quantity: existingVariant?.quantity || 0
          });
        });
      });
    } else if (colors.length > 0) {
      colors.forEach(color => {
        const existingVariant = variants.find(v => v.color === color.value && !v.size);
        newVariants.push({
          color: color.value,
          quantity: existingVariant?.quantity || 0
        });
      });
    } else if (sizes.length > 0) {
      sizes.forEach(size => {
        const existingVariant = variants.find(v => v.size === size && !v.color);
        newVariants.push({
          size: size,
          quantity: existingVariant?.quantity || 0
        });
      });
    }
    
    setVariants(newVariants);
  }, [colors, sizes, variants]);

  useEffect(() => {
    updateVariants();
  }, [colors, sizes]);

  const handleVariantQuantityChange = (index: number, quantity: number) => {
    const updatedVariants = [...variants];
    updatedVariants[index].quantity = quantity;
    setVariants(updatedVariants);
  };

  const loadCategories = useCallback(async () => {
    const cats = await getCategories();
    setCategories(cats);
  }, []);

  useEffect(() => {
    loadCategories();
    const handleFocus = () => {
      loadCategories();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadCategories]);

  const handleImagesChange = (newMainImage: string | null, newAdditionalImages: string[]) => {
    setMainImage(newMainImage);
    setAdditionalImages(newAdditionalImages);
  };

  const handlePriceChange = (inputValue: string) => {
    const formattedValue = formatPriceInput(inputValue);
    setPrice(formattedValue);
  };

  const handleCostChange = (inputValue: string) => {
    const formattedValue = formatPriceInput(inputValue);
    setCost(formattedValue);
  };

  const handleDiscountValueChange = (inputValue: string) => {
    const formattedValue = formatPriceInput(inputValue);
    setDiscountValue(formattedValue);
  };

  const formatDisplayPrice = (priceValue: string): string => {
    if (!priceValue) return '';
    const numericValue = parseFloat(priceValue.replace(/,/g, ''));
    if (isNaN(numericValue) || numericValue === 0) return '';
    return numericValue.toLocaleString('en-US');
  };

  const addAdditionalProduct = () => {
    setAdditionalProducts([...additionalProducts, ""]);
  };

  const removeAdditionalProduct = (index: number) => {
    setAdditionalProducts(additionalProducts.filter((_, i) => i !== index));
  };

  const updateAdditionalProduct = (index: number, value: string) => {
    const updated = [...additionalProducts];
    updated[index] = value;
    setAdditionalProducts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "خطأ",
        description: "يجب تسجيل الدخول أولاً",
        variant: "destructive"
      });
      return;
    }
    
    if (!name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم المنتج",
        variant: "destructive"
      });
      return;
    }
    
    if (!category) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار فئة المنتج",
        variant: "destructive"
      });
      return;
    }
    
    if (!price || !isValidPrice(price)) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال سعر صحيح",
        variant: "destructive"
      });
      return;
    }

    if (!mainImage) {
      toast({
        title: "خطأ",
        description: "يرجى إضافة صورة رئيسية للمنتج",
        variant: "destructive"
      });
      return;
    }

    const newProduct: Product = {
      id: '',
      name,
      description,
      category,
      price: Number(formatPriceInput(price)),
      cost: cost ? Number(formatPriceInput(cost)) : undefined,
      image: mainImage,
      additionalImages: additionalImages,
      sizes: sizes.length > 0 ? sizes : undefined,
      colors: colors.length > 0 ? colors : undefined,
      stockQuantity: stockQuantity ? parseInt(stockQuantity) : undefined,
      variants: variants.length > 0 ? variants : undefined,
      // Discount data
      discountType: discountType !== 'none' ? discountType : undefined,
      discountValue: discountValue && discountType !== 'none' ? Number(formatPriceInput(discountValue)) : undefined,
      discountStartDate: discountStartDate ? discountStartDate.toISOString() : undefined,
      discountEndDate: discountEndDate ? discountEndDate.toISOString() : undefined,
      // Advanced features
      brand: brand || undefined,
      productClassification: productClassification || undefined,
      sku: sku || undefined,
      freeShipping,
      additionalProducts: additionalProducts.filter(p => p.trim().length > 0)
    };

    const result = await addProduct(newProduct);
    
    if (result.success) {
      toast({
        title: "تم بنجاح",
        description: "تمت إضافة منتج جديد",
      });
      navigate('/products');
    } else {
      toast({
        title: "خطأ",
        description: result.error || "فشل في إضافة المنتج",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">إضافة منتج جديد</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Form with Tabs */}
      <div className="max-w-4xl mx-auto p-6">
        <form className="bg-white rounded-3xl p-8 shadow-sm" onSubmit={handleSubmit}>
          <Tabs defaultValue="product" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="product" className="text-right">منتج</TabsTrigger>
              <TabsTrigger value="discount" className="text-right">الخصم</TabsTrigger>
              <TabsTrigger value="advanced" className="text-right">الخصائص المتقدمة</TabsTrigger>
            </TabsList>

            {/* Product Tab */}
            <TabsContent value="product" className="space-y-8">
              {/* Image Upload */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <ProductImagesManager 
                  mainImage={mainImage}
                  additionalImages={additionalImages}
                  onImagesChange={handleImagesChange}
                />
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="name" className="block text-black font-medium text-right">اسم المنتج *</Label>
                  <Input 
                    id="name" 
                    className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="أدخل اسم المنتج"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="category" className="block text-black font-medium text-right">الفئة *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="اختر فئة" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name} className="text-right">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <Label htmlFor="description" className="block text-black font-medium text-right">الوصف</Label>
                <Textarea 
                  id="description" 
                  className="text-right text-black rounded-2xl border-gray-200 min-h-[120px] focus:border-blue-500 focus:ring-blue-500" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="أدخل وصف المنتج"
                />
              </div>

              {/* Price and Cost */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="price" className="block text-black font-medium text-right">سعر البيع (دينار عراقي) *</Label>
                  <Input 
                    id="price" 
                    type="text" 
                    className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" 
                    value={formatDisplayPrice(price)}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="أدخل سعر البيع"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="cost" className="block text-black font-medium text-right">التكلفة (دينار عراقي) - اختياري</Label>
                  <Input 
                    id="cost" 
                    type="text" 
                    className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" 
                    value={formatDisplayPrice(cost)}
                    onChange={(e) => handleCostChange(e.target.value)}
                    placeholder="أدخل تكلفة المنتج"
                  />
                </div>
              </div>

              {/* Stock Quantity */}
              <div className="space-y-3">
                <Label htmlFor="stockQuantity" className="block text-black font-medium text-right">الكمية الإجمالية</Label>
                <Input
                  id="stockQuantity"
                  type="number"
                  placeholder="أدخل الكمية المتاحة"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  min="0"
                />
              </div>

              {/* Sizes and Colors */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 rounded-2xl p-6">
                  <SizesManager sizes={sizes} onSizesChange={setSizes} />
                </div>
                
                <div className="bg-gray-50 rounded-2xl p-6">
                  <ColorSwatchPicker colors={colors} onColorsChange={setColors} />
                </div>
              </div>

              {/* Category Management */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <Label className="text-right block text-black font-medium mb-4">إدارة الفئات</Label>
                <CategoryManagement 
                  categories={categories} 
                  onCategoryChange={loadCategories} 
                />
              </div>

              {/* Variants Quantities */}
              {variants.length > 0 && (
                <div className="space-y-4 bg-gray-50 rounded-2xl p-6">
                  <Label className="text-right block text-black font-medium">كميات المتغيرات</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {variants.map((variant, index) => (
                      <div key={index} className="p-3 border rounded-lg bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {variant.color && (
                              <div 
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: variant.color }}
                              />
                            )}
                            <span className="text-sm">
                              {variant.color && variant.size ? `${variant.size}` : variant.color ? 'لون' : variant.size}
                            </span>
                          </div>
                        </div>
                        <Input
                          type="number"
                          placeholder="الكمية"
                          value={variant.quantity}
                          onChange={(e) => handleVariantQuantityChange(index, parseInt(e.target.value) || 0)}
                          className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          min="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Discount Tab */}
            <TabsContent value="discount" className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="block text-black font-medium text-right">نوع الخصم</Label>
                  <Select value={discountType} onValueChange={(value: 'none' | 'percentage' | 'amount') => setDiscountType(value)}>
                    <SelectTrigger className="w-full text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="تحديد خيار" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="none" className="text-right">بدون خصم</SelectItem>
                      <SelectItem value="percentage" className="text-right">نسبة مئوية</SelectItem>
                      <SelectItem value="amount" className="text-right">مبلغ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {discountType !== 'none' && (
                  <>
                    <div className="space-y-3">
                      <Label className="block text-black font-medium text-right">قيمة الخصم</Label>
                      <Input
                        type="text"
                        placeholder={discountType === 'percentage' ? 'أدخل النسبة المئوية' : 'أدخل قيمة الخصم'}
                        value={formatDisplayPrice(discountValue)}
                        onChange={(e) => handleDiscountValueChange(e.target.value)}
                        className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <Label className="block text-black font-medium text-right">تاريخ بدء الخصم</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-right font-normal rounded-2xl",
                                !discountStartDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {discountStartDate ? format(discountStartDate, "dd/MM/yyyy") : <span>mm/dd/yyyy</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={discountStartDate}
                              onSelect={setDiscountStartDate}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-3">
                        <Label className="block text-black font-medium text-right">تاريخ انتهاء الخصم</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-right font-normal rounded-2xl",
                                !discountEndDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {discountEndDate ? format(discountEndDate, "dd/MM/yyyy") : <span>mm/dd/yyyy</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={discountEndDate}
                              onSelect={setDiscountEndDate}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Advanced Features Tab */}
            <TabsContent value="advanced" className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="block text-black font-medium text-right">براند</Label>
                  <Input
                    placeholder="أدخل اسم البراند"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="block text-black font-medium text-right">تصنيف المنتج</Label>
                  <Select value={productClassification} onValueChange={setProductClassification}>
                    <SelectTrigger className="w-full text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="تحديد خيار" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="new" className="text-right">جديد</SelectItem>
                      <SelectItem value="used" className="text-right">مستعمل</SelectItem>
                      <SelectItem value="refurbished" className="text-right">مُجدد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="block text-black font-medium text-right">المنتجات الإضافية</Label>
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-gray-500 cursor-help" />
                      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        في حال تفعيل التوصيل المجاني، لن يتم فرض مبلغ من قيمة المنتج والمنتجات الإضافية في نفس السلة
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {additionalProducts.map((product, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeAdditionalProduct(index)}
                          className="text-red-500 hover:bg-red-50 rounded-xl border-red-200"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Input
                          placeholder="أدخل اسم المنتج الإضافي"
                          value={product}
                          onChange={(e) => updateAdditionalProduct(index, e.target.value)}
                          className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addAdditionalProduct}
                      className="w-full text-gray-600 border-dashed border-gray-300 hover:bg-gray-50 rounded-2xl"
                    >
                      إضافة منتج +
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="block text-black font-medium text-right">وحدة حفظ المخزون SKU</Label>
                  <Input
                    placeholder="أدخل رمز SKU"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="freeShipping"
                    checked={freeShipping}
                    onCheckedChange={(checked) => setFreeShipping(checked as boolean)}
                  />
                  <Label htmlFor="freeShipping" className="text-black font-medium cursor-pointer">
                    توصيل مجاني
                  </Label>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Submit Button */}
          <div className="flex justify-center pt-8">
            <Button 
              type="submit" 
              className="text-white px-12 py-4 text-lg rounded-2xl shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, #5b47f5, #4c3ef7)',
                boxShadow: '0 8px 25px rgba(91, 71, 245, 0.3)'
              }}
            >
              إضافة المنتج +
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;