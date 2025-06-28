import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { categories, getProductById, products } from "@/data/dummyData";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";
import SizesManager from "@/components/SizesManager";
import ColorsManager from "@/components/ColorsManager";

const EditProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

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
    
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
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
        price: Number(price),
        image: mainImage,
        additionalImages,
        sizes: sizes.length > 0 ? sizes : undefined,
        colors: colors.length > 0 ? colors : undefined,
      };

      // Find and update the product in the array
      const productIndex = products.findIndex(p => p.id === productId);
      if (productIndex !== -1) {
        products[productIndex] = updatedProduct;
      }

      // Show success toast
      toast({
        title: "تم بنجاح",
        description: "تم تحديث بيانات الوجبة",
      });

      // Navigate back to builder
      navigate('/builder');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4 flex justify-between items-center">
        <Link to="/builder">
          <X className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold">تعديل الوجبة</h1>
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
            <Label htmlFor="name" className="block text-dark-green">اسم الوجبة</Label>
            <Input 
              id="name" 
              className="text-right text-dark-green" 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2 text-right">
            <Label htmlFor="category" className="block text-dark-green">الفئة</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full text-right text-dark-green">
                <SelectValue placeholder="اختر فئة" />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(c => c.id !== "all").map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2 text-right">
            <Label htmlFor="description" className="block text-dark-green">الوصف</Label>
            <Textarea 
              id="description" 
              className="text-right text-dark-green" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Price */}
          <div className="space-y-2 text-right">
            <Label htmlFor="price" className="block text-dark-green">السعر (دينار عراقي)</Label>
            <Input 
              id="price" 
              type="number" 
              className="text-right text-dark-green" 
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          {/* Sizes Manager */}
          <SizesManager sizes={sizes} onSizesChange={setSizes} />

          {/* Colors Manager */}
          <ColorsManager colors={colors} onColorsChange={setColors} />

          {/* Submit Button */}
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
            حفظ التغييرات
          </Button>
        </form>
      </div>
    </div>
  );
};

export default EditProduct;
