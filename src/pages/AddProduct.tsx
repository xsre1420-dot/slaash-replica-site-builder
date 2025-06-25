
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { categories, addProduct } from "@/data/dummyData";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";

const AddProduct = () => {
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

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

    // Create new product
    const newProduct: Product = {
      id: Date.now().toString(), // Generate a unique ID
      name,
      description,
      category,
      price: Number(price),
      image: mainImage,
      additionalImages: additionalImages,
    };

    // Add product to the list
    addProduct(newProduct);

    // Show success toast
    toast({
      title: "تم بنجاح",
      description: "تمت إضافة وجبة جديدة",
    });

    // Navigate back to builder
    navigate('/builder');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4 flex justify-between items-center">
        <Link to="/builder">
          <X className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold">إضافة وجبة جديدة</h1>
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
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
            إضافة الوجبة +
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;
