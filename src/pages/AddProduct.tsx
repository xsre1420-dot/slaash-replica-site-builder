
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getCategories, addProduct } from "@/data/dummyData";
import { useToast } from "@/hooks/use-toast";
import { Product, Category, ColorOption } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";
import SizesManager from "@/components/SizesManager";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import { formatPriceInput, isValidPrice } from "@/utils/numberUtils";

const AddProduct = () => {
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load categories on mount
  useEffect(() => {
    setCategories(getCategories());
  }, []);

  const handleImagesChange = (newMainImage: string | null, newAdditionalImages: string[]) => {
    setMainImage(newMainImage);
    setAdditionalImages(newAdditionalImages);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم الوجبة",
        variant: "destructive"
      });
      return;
    }
    
    if (!category) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار فئة الوجبة",
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
      id: Date.now().toString(),
      name,
      description,
      category,
      price: Number(formatPriceInput(price)),
      image: mainImage,
      additionalImages: additionalImages,
      sizes: sizes.length > 0 ? sizes : undefined,
      colors: colors.length > 0 ? colors : undefined,
    };

    addProduct(newProduct);

    toast({
      title: "تم بنجاح",
      description: "تمت إضافة وجبة جديدة",
    });

    navigate('/builder');
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
            <h1 className="text-2xl font-bold text-gray-800">إضافة وجبة جديدة</h1>
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
              <Label htmlFor="name" className="block text-black font-medium text-right">اسم الوجبة</Label>
              <Input 
                id="name" 
                className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسم الوجبة"
              />
            </div>

            {/* Category */}
            <div className="space-y-3">
              <Label htmlFor="category" className="block text-black font-medium text-right">الفئة</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="اختر فئة" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="text-right">
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
              placeholder="أدخل وصف الوجبة"
            />
          </div>

          {/* Price */}
          <div className="space-y-3">
            <Label htmlFor="price" className="block text-black font-medium text-right">السعر (دينار عراقي)</Label>
              <Input 
                id="price" 
                type="text" 
                className="text-right text-black rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" 
                value={price}
                onChange={(e) => setPrice(formatPriceInput(e.target.value))}
                placeholder="0"
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
              إضافة الوجبة +
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;
