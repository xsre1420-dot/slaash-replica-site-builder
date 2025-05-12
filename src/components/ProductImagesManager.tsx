
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ImagePlus, X, CheckCircle, ArrowUp, ArrowDown } from "lucide-react";
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
  const [selectedMainIndex, setSelectedMainIndex] = useState<number | null>(null);
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

    // إذا كانت هناك صورة رئيسية موجودة، أضفها إلى الصور الإضافية
    if (mainImage) {
      updatedImages.unshift(mainImage);
    }

    onImagesChange(newMain, updatedImages);
    toast({
      title: "تم تعيين الصورة الرئيسية",
      description: "تم تعيين الصورة الرئيسية بنجاح",
    });
  };

  const moveImage = (fromIndex: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && fromIndex <= (mainImage ? 1 : 0)) || 
      (direction === 'down' && fromIndex >= allImages.length - 1)
    ) {
      return;
    }

    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    
    // لا تسمح بتحريك الصورة الرئيسية
    if (fromIndex === 0 && mainImage) return;
    
    // لا تسمح بالتحريك فوق الصورة الرئيسية
    if (toIndex === 0 && mainImage) return;

    const updatedImages = [...allImages];
    const [movedImage] = updatedImages.splice(fromIndex, 1);
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
      <div className="flex justify-between items-center">
        <Label className="block">صور المنتج</Label>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleImageUpload}
          multiple
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleChooseFile}
          type="button"
        >
          <ImagePlus className="w-4 h-4 ml-2" />
          إضافة صور
        </Button>
      </div>

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
              
              {index > (mainImage ? 0 : -1) && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/30 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 text-white hover:text-white hover:bg-black/20"
                    onClick={() => moveImage(index, 'up')}
                    disabled={index <= (mainImage ? 1 : 0)}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon" 
                    className="h-6 w-6 p-0 text-white hover:text-white hover:bg-black/20"
                    onClick={() => moveImage(index, 'down')}
                    disabled={index >= allImages.length - 1}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {index === 0 && mainImage && (
                <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-center text-xs py-1">
                  الصورة الرئيسية
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductImagesManager;
