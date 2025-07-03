
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { getCategories, getProductById, updateProduct } from "@/data/dummyData";
import { useToast } from "@/hooks/use-toast";
import { Product, Category, ColorOption } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";
import SizesManager from "@/components/SizesManager";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import { formatPriceInput, isValidPrice } from "@/utils/numberUtils";

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
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load categories on mount
  useEffect(() => {
    setCategories(getCategories());
  }, []);

  useEffect(() => {
    if (productId) {
      const product = getProductById(productId);
      if (product) {
        setName(product.name);
        setDescription(product.description);
        setCategory(product.category);
        setPrice(product.price.toString());
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
        navigate('/builder');
      }
    }
  }, [productId, navigate, toast]);

  const handleImagesChange = (newMainImage: string | null, newAdditionalImages: string[]) => {
    setMainImage(newMainImage);
    setAdditionalImages(newAdditionalImages);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
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

    // Update the product
    if (productId) {
      const updatedProduct: Product = {
        id: productId,
        name,
        description,
        category,
        price: Number(formatPriceInput(price)),
        image: mainImage,
        additionalImages,
        sizes: sizes.length > 0 ? sizes : undefined,
        colors: colors.length > 0 ? colors : undefined,
      };

      // Update the product using the updateProduct function
      updateProduct(productId, updatedProduct);

      // Show success toast
      toast({
        title: "تم بنجاح",
        description: "تم تحديث بيانات المنتج",
      });

      // Navigate back to builder
      navigate('/builder');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white text-gray-800 p-4 flex justify-between items-center border-b border-gray-100">
        <Link to="/builder">
          <X className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold text-black">تعديل المنتج</h1>
        <div className="w-6" /> {/* Spacer for alignment */}
      </div>

      {/* Form */}
      <div className="max-w-xl mx-auto p-4">
        <form className="bg-white rounded-xl p-6 shadow-sm space-y-6" onSubmit={handleSubmit}>
          {/* Image Upload */}
          <ProductImagesManager 
            mainImage={mainImage}
            additionalImages={additionalImages}
            onImagesChange={handleImagesChange}
          />

          {/* Name */}
          <div className="space-y-2 text-right">
            <Label htmlFor="name" className="block text-black">اسم المنتج</Label>
            <Input 
              id="name" 
              className="text-right text-black focus:border-blue-500 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2 text-right">
            <Label htmlFor="category" className="block text-black">الفئة</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full text-right text-black focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="اختر فئة" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2 text-right">
            <Label htmlFor="description" className="block text-black">الوصف</Label>
            <Textarea 
              id="description" 
              className="text-right text-black focus:border-blue-500 focus:ring-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Price */}
          <div className="space-y-2 text-right">
            <Label htmlFor="price" className="block text-black">السعر (دينار عراقي)</Label>
            <Input 
              id="price" 
              type="text" 
              className="text-right text-black focus:border-blue-500 focus:ring-blue-500" 
              value={price}
              onChange={(e) => setPrice(formatPriceInput(e.target.value))}
            />
          </div>

          {/* Sizes Manager */}
          <SizesManager sizes={sizes} onSizesChange={setSizes} />

          {/* Colors Manager */}
          <ColorSwatchPicker colors={colors} onColorsChange={setColors} />

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full text-white shadow-lg"
            style={{ 
              background: 'linear-gradient(135deg, #5b47f5, #4c3ef7)',
              boxShadow: '0 4px 15px rgba(91, 71, 245, 0.3)'
            }}
          >
            حفظ التغييرات
          </Button>
        </form>
      </div>
    </div>
  );
};

export default EditProduct;
