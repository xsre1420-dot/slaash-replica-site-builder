
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { getCategories, addProduct, getCategoriesSync } from "@/data/dummyData";
import { useToast } from "@/hooks/use-toast";
import { Product, Category, ColorOption, ProductVariant } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";
import SizesManager from "@/components/SizesManager";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import CategoryDialog from "@/components/CategoryDialog";
import { formatPriceInput, isValidPrice } from "@/utils/numberUtils";

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
      // إذا كان هناك ألوان وقياسات
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
      // إذا كان هناك ألوان فقط
      colors.forEach(color => {
        const existingVariant = variants.find(v => v.color === color.value && !v.size);
        newVariants.push({
          color: color.value,
          quantity: existingVariant?.quantity || 0
        });
      });
    } else if (sizes.length > 0) {
      // إذا كان هناك قياسات فقط
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

  // Load categories on mount and when window gains focus
  useEffect(() => {
    loadCategories();

    // Refresh categories when window gains focus (user might have added a category in another tab)
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
    // Convert Arabic numerics to English and format
    const formattedValue = formatPriceInput(inputValue);
    setPrice(formattedValue);
  };

  const handleCostChange = (inputValue: string) => {
    // Convert Arabic numerics to English and format
    const formattedValue = formatPriceInput(inputValue);
    setCost(formattedValue);
  };

  const formatDisplayPrice = (priceValue: string): string => {
    if (!priceValue) return '';
    const numericValue = parseFloat(priceValue.replace(/,/g, ''));
    if (isNaN(numericValue) || numericValue === 0) return '';
    return numericValue.toLocaleString('en-US');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      id: '', // Will be generated by Supabase
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
    };

    const result = await addProduct(newProduct);
    
    if (result.success) {
      toast({
        title: "تم بنجاح",
        description: "تمت إضافة منتج جديد",
      });
      navigate('/builder');
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
      {/* Modern Header */}
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

      {/* Form */}
      <div className="max-w-4xl mx-auto p-6">
        <form className="bg-white rounded-3xl p-8 shadow-sm space-y-8" onSubmit={handleSubmit}>
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
            {/* Name */}
            <div className="space-y-3">
              <Label htmlFor="name" className="block text-black font-medium text-right">اسم المنتج</Label>
              <Input 
                id="name" 
                className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسم المنتج"
              />
            </div>

            {/* Category */}
            <div className="space-y-3">
              <Label htmlFor="category" className="block text-black font-medium text-right">الفئة</Label>
              <div className="space-y-2">
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
                <CategoryDialog onCategoryAdded={loadCategories} />
              </div>
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
            {/* Selling Price */}
            <div className="space-y-3">
              <Label htmlFor="price" className="block text-black font-medium text-right">سعر البيع (دينار عراقي)</Label>
              <Input 
                id="price" 
                type="text" 
                className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" 
                value={formatDisplayPrice(price)}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="أدخل سعر البيع"
              />
            </div>

            {/* Cost Price */}
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
