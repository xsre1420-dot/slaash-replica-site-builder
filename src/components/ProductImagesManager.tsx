
import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, CheckCircle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { uploadImage } from "@/utils/imageUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const allImages = useMemo(() => [
    ...(mainImage ? [mainImage] : []),
    ...additionalImages,
  ], [mainImage, additionalImages]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Get user ID for storage path
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const totalFiles = files.length;
    const uploadedUrls: string[] = [];
    let completed = 0;

    try {
      // Upload all files concurrently
      const uploadPromises = Array.from(files).map(async (file) => {
        // Compress image if too large (> 2MB)
        const processedFile = file.size > 2 * 1024 * 1024 ? await compressImage(file) : file;
        const url = await uploadImage(processedFile, user.id);
        completed++;
        setUploadProgress(Math.round((completed / totalFiles) * 100));
        return url;
      });

      const results = await Promise.allSettled(uploadPromises);
      results.forEach(r => {
        if (r.status === 'fulfilled') uploadedUrls.push(r.value);
      });

      if (uploadedUrls.length === 0) {
        toast.error("فشل في رفع الصور");
        return;
      }

      if (uploadedUrls.length < totalFiles) {
        toast.warning(`تم رفع ${uploadedUrls.length} من ${totalFiles} صور`);
      }

      if (!mainImage && uploadedUrls.length > 0) {
        onImagesChange(uploadedUrls[0], [...additionalImages, ...uploadedUrls.slice(1)]);
      } else {
        onImagesChange(mainImage, [...additionalImages, ...uploadedUrls]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("حدث خطأ أثناء رفع الصور");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (event.target) event.target.value = '';
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width *= ratio;
          height *= ratio;
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleChooseFile = () => fileInputRef.current?.click();

  const removeImage = (index: number) => {
    const isMainImage = index === 0 && mainImage;
    const updatedImages = [...allImages];
    updatedImages.splice(index, 1);

    if (isMainImage) {
      const newMain = updatedImages.length > 0 ? updatedImages[0] : null;
      const newAdditional = updatedImages.slice(newMain ? 1 : 0);
      onImagesChange(newMain, newAdditional);
    } else {
      onImagesChange(mainImage, updatedImages.filter(img => img !== mainImage));
    }
  };

  const setAsMain = (index: number) => {
    if (index === 0 && mainImage) return;
    const updatedImages = [...allImages];
    const newMain = updatedImages[index];
    updatedImages.splice(index, 1);
    onImagesChange(newMain, [...updatedImages]);
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
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <div className="flex flex-col items-center">
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 text-primary mb-2 animate-spin" />
                <p className="text-muted-foreground mb-2">جاري رفع الصور... {uploadProgress}%</p>
                <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </>
            ) : (
              <>
                <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground mb-2">لا توجد صور للمنتج</p>
                <Button variant="outline" className="mt-2" onClick={handleChooseFile} type="button">
                  <ImagePlus className="w-4 h-4 ml-2" />
                  اختيار صور
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <Button variant="outline" size="sm" onClick={handleChooseFile} type="button" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الرفع... {uploadProgress}%
                </>
              ) : (
                <>
                  <ImagePlus className="w-4 h-4 ml-2" />
                  إضافة صور
                </>
              )}
            </Button>
            <Label className="block">صور المنتج</Label>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {allImages.map((image, index) => (
              <div
                key={index}
                className={`relative rounded-lg overflow-hidden border-2 ${
                  index === 0 && mainImage ? "border-primary" : "border-border"
                } group`}
              >
                <div className="aspect-square w-full">
                  <img src={image} alt={`صورة المنتج ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </div>
                
                <div className="absolute top-0 right-0 p-1 bg-card/80 backdrop-blur-sm rounded-bl-lg">
                  {index === 0 && mainImage ? (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  ) : (
                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => setAsMain(index)} title="تعيين كصورة رئيسية">
                      <CheckCircle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                    </Button>
                  )}
                </div>
                
                <div className="absolute top-0 left-0 p-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 bg-card/80 backdrop-blur-sm rounded-full p-0 hover:bg-destructive/10" onClick={() => removeImage(index)}>
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                
                {index === 0 && mainImage && (
                  <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-center text-xs py-1">
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
