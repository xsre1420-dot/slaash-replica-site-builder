
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, CheckCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ProductImagesManagerProps {
  mainImage: string | null;
  additionalImages: string[];
  onImagesChange: (mainImage: string | null, additionalImages: string[]) => void;
}

const ProductImagesManager = ({
  mainImage,
  additionalImages,
  onImagesChange,
}: ProductImagesManagerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const allImages = [
    ...(mainImage ? [mainImage] : []),
    ...additionalImages,
  ];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: string[] = [];

    Array.from(files).forEach(file => {
      const objectUrl = URL.createObjectURL(file);
      newImages.push(objectUrl);
    });

    if (!mainImage && newImages.length > 0) {
      // إذا لم تكن هناك صورة رئيسية، فاستخدم الصورة الأولى المضافة كصورة رئيسية
      onImagesChange(newImages[0], [...additionalImages, ...newImages.slice(1)]);
      toast({
        title: "تم إضافة الصور",
        description: `تم إضافة ${newImages.length} صور بنجاح`,
      });
    } else {
      // أضف الصور الجديدة إلى الصور الإضافية
      onImagesChange(mainImage, [...additionalImages, ...newImages]);
      toast({
        title: "تم إضافة الصور",
        description: `تم إضافة ${newImages.length} صور بنجاح`,
      });
    }

    // أعد تعيين حقل الإدخال ليتمكن المستخدم من اختيار نفس الصور مرة أخرى إذا أراد
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleChooseFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removeImage = (index: number) => {
    const isMainImage = index === 0 && mainImage;
    const updatedImages = [...allImages];
    updatedImages.splice(index, 1);

    if (isMainImage) {
      // إذا كانت الصورة الرئيسية محذوفة، استخدم الصورة الأولى في القائمة الإضافية كصورة رئيسية
      const newMain = updatedImages.length > 0 ? updatedImages[0] : null;
      const newAdditional = updatedImages.slice(newMain ? 1 : 0);
      onImagesChange(newMain, newAdditional);
    } else {
      onImagesChange(mainImage, updatedImages.filter(img => img !== mainImage));
    }

    toast({
      title: "تم حذف الصورة",
      description: "تم حذف الصورة بنجاح",
    });
  };

  const setAsMain = (index: number) => {
    if (index === 0 && mainImage) return; // إذا كانت بالفعل الصورة الرئيسية

    const updatedImages = [...allImages];
    const newMain = updatedImages[index];
    updatedImages.splice(index, 1); // إزالة الصورة من موقعها الحالي

    // أضف باقي الصور إلى الصور الإضافية
    const newAdditional = [...updatedImages];

    onImagesChange(newMain, newAdditional);
    toast({
      title: "تم تعيين الصورة الرئيسية",
      description: "تم تعيين الصورة الرئيسية بنجاح",
    });
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index <= (mainImage ? 1 : 0)) || 
      (direction === 'down' && index >= allImages.length - 1)
    ) {
      return;
    }

    const toIndex = direction === 'up' ? index - 1 : index + 1;
    
    // لا تسمح بتحريك الصورة الرئيسية
    if (index === 0 && mainImage) return;
    
    // لا تسمح بالتحريك فوق الصورة الرئيسية
    if (toIndex === 0 && mainImage) return;

    const updatedImages = [...allImages];
    const [movedImage] = updatedImages.splice(index, 1);
    updatedImages.splice(toIndex, 0, movedImage);

    // أعد تعيين المصفوفات مع المراعاة المناسبة للصورة الرئيسية
    if (mainImage) {
      onImagesChange(updatedImages[0], updatedImages.slice(1));
    } else {
      onImagesChange(null, updatedImages);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageUpload}
        multiple
      />

      {allImages.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
          <div className="flex flex-col items-center">
            <ImagePlus className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-gray-500 mb-2">لا توجد صور للمنتج</p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={handleChooseFile}
              type="button"
            >
              <ImagePlus className="w-4 h-4 ml-2" />
              اختيار صور
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleChooseFile}
              type="button"
            >
              <ImagePlus className="w-4 h-4 ml-2" />
              إضافة صور
            </Button>
            <Label className="block">صور المنتج</Label>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {allImages.map((image, index) => (
              <div
                key={index}
                className={`relative rounded-lg overflow-hidden border-2 ${
                  index === 0 && mainImage ? "border-red-500" : "border-gray-200"
                } group`}
              >
                <div className="aspect-square w-full">
                  <img
                    src={image}
                    alt={`صورة المنتج ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="absolute top-0 right-0 p-1 bg-white rounded-bl-lg">
                  {index === 0 && mainImage ? (
                    <CheckCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0"
                      onClick={() => setAsMain(index)}
                      title="تعيين كصورة رئيسية"
                    >
                      <CheckCircle className="w-5 h-5 text-gray-400 hover:text-red-500" />
                    </Button>
                  )}
                </div>
                
                <div className="absolute top-0 left-0 p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 bg-white rounded-full p-0 hover:bg-red-50"
                    onClick={() => removeImage(index)}
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
                
                {index === 0 && mainImage && (
                  <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-center text-xs py-1">
                    الصورة الرئيسية
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductImagesManager;
