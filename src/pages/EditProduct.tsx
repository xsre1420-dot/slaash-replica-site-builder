
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ImagePlus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { categories, getProductById, products } from "@/data/dummyData";
import { useToast } from "@/components/ui/use-toast";
import { Product } from "@/types";

const EditProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (productId) {
      const product = getProductById(productId);
      if (product) {
        setName(product.name);
        setDescription(product.description);
        setCategory(product.category);
        setPrice(product.price.toString());
        setImagePreview(product.image);
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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
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

    // Update the product
    if (productId) {
      const updatedProduct: Product = {
        id: productId,
        name,
        description,
        category,
        price: Number(price),
        image: imagePreview || "/lovable-uploads/59c215d6-809e-4764-90cd-41fd1213f286.png",
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
      <div className="bg-red-600 text-white p-4 flex justify-between items-center">
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
          <div className="space-y-2 text-right">
            <Label className="block">صورة الوجبة</Label>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageChange}
            />
            <div 
              className={`border-2 border-dashed border-gray-200 rounded-lg p-4 text-center ${
                imagePreview ? 'pt-0' : ''
              }`}
            >
              {imagePreview ? (
                <div className="space-y-4">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleChooseFile}
                    type="button"
                  >
                    تغيير الصورة
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleChooseFile}
                    type="button"
                  >
                    <ImagePlus className="w-4 h-4 ml-2" />
                    اختيار ملف
                  </Button>
                  <p className="mt-2 text-sm text-gray-500">لم يتم تحديد أي ملف</p>
                </>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2 text-right">
            <Label htmlFor="name" className="block">اسم الوجبة</Label>
            <Input 
              id="name" 
              className="text-right" 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2 text-right">
            <Label htmlFor="category" className="block">الفئة</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full text-right">
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
            <Label htmlFor="description" className="block">الوصف</Label>
            <Textarea 
              id="description" 
              className="text-right" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Price */}
          <div className="space-y-2 text-right">
            <Label htmlFor="price" className="block">السعر (دينار عراقي)</Label>
            <Input 
              id="price" 
              type="number" 
              className="text-right" 
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
            حفظ التغييرات
          </Button>
        </form>
      </div>
    </div>
  );
};

export default EditProduct;
