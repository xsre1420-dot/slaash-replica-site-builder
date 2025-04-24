import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ImagePlus } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useRef } from "react";

const AddProduct = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white p-4 flex justify-between items-center">
        <Link to="/builder">
          <X className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold">إضافة وجبة جديدة</h1>
        <div className="w-6" /> {/* Spacer for alignment */}
      </div>

      {/* Form */}
      <div className="max-w-xl mx-auto p-4">
        <form className="bg-white rounded-xl p-6 shadow-sm space-y-6">
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
            <Input id="name" className="text-right" />
          </div>

          {/* Category */}
          <div className="space-y-2 text-right">
            <Label htmlFor="category" className="block">الفئة</Label>
            <Select>
              <SelectTrigger className="w-full text-right">
                <SelectValue placeholder="الوجبات الرئيسية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">الوجبات الرئيسية</SelectItem>
                <SelectItem value="appetizers">المقبلات</SelectItem>
                <SelectItem value="drinks">المشروبات</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2 text-right">
            <Label htmlFor="description" className="block">الوصف</Label>
            <Textarea id="description" className="text-right" />
          </div>

          {/* Price */}
          <div className="space-y-2 text-right">
            <Label htmlFor="price" className="block">السعر (دينار عراقي)</Label>
            <Input id="price" type="number" className="text-right" />
          </div>

          {/* Submit Button */}
          <Button className="w-full bg-red-600 hover:bg-red-700">
            إضافة الوجبة +
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;
