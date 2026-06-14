import { useState, useRef, useMemo, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Star, GripVertical, Loader2, Upload } from "lucide-react";
import { uploadImage, deleteImage } from "@/utils/imageUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProductImagesManagerProps {
  mainImage: string | null;
  additionalImages: string[];
  onImagesChange: (mainImage: string | null, additionalImages: string[]) => void;
  onUploadStateChange?: (isUploading: boolean) => void;
}

const MAX_IMAGES = 10;

const ProductImagesManager = ({
  mainImage,
  additionalImages,
  onImagesChange,
  onUploadStateChange,
}: ProductImagesManagerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const allImages = useMemo(
    () => [...(mainImage ? [mainImage] : []), ...additionalImages],
    [mainImage, additionalImages]
  );

  const compressImage = (file: File): Promise<File> =>
    new Promise((resolve) => {
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
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) {
      toast.error('يرجى اختيار ملفات صور فقط');
      return;
    }

    const remaining = MAX_IMAGES - allImages.length;
    if (remaining <= 0) {
      toast.error(`الحد الأقصى ${MAX_IMAGES} صور`);
      return;
    }
    const toUpload = list.slice(0, remaining);
    if (toUpload.length < list.length) {
      toast.warning(`يمكن إضافة ${remaining} صور فقط (الحد ${MAX_IMAGES})`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    setIsUploading(true);
    onUploadStateChange?.(true);
    setUploadProgress(0);
    const uploadedUrls: string[] = [];
    let completed = 0;

    try {
      const results = await Promise.allSettled(
        toUpload.map(async (file) => {
          const processed = file.size > 2 * 1024 * 1024 ? await compressImage(file) : file;
          const url = await uploadImage(processed, user.id);
          completed++;
          setUploadProgress(Math.round((completed / toUpload.length) * 100));
          return url;
        })
      );
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') uploadedUrls.push(r.value);
        else console.error('Upload failed:', toUpload[i]?.name, r.reason);
      });

      if (uploadedUrls.length === 0) {
        toast.error('فشل في رفع الصور');
        return;
      }

      if (uploadedUrls.length < toUpload.length) {
        toast.warning(`تم رفع ${uploadedUrls.length} من ${toUpload.length}`);
      }

      if (!mainImage) {
        onImagesChange(uploadedUrls[0], [...additionalImages, ...uploadedUrls.slice(1)]);
      } else {
        onImagesChange(mainImage, [...additionalImages, ...uploadedUrls]);
      }
    } catch {
      toast.error('حدث خطأ أثناء رفع الصور');
    } finally {
      setIsUploading(false);
      onUploadStateChange?.(false);
      setUploadProgress(0);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void uploadFiles(event.target.files);
    if (event.target) event.target.value = '';
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFiles(false);
      if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
    },
    [mainImage, additionalImages]
  );

  const removeImage = (index: number) => {
    const updated = [...allImages];
    const removed = updated.splice(index, 1)[0];
    onImagesChange(updated[0] ?? null, updated.slice(1));
    if (removed && !removed.startsWith('blob:')) {
      void deleteImage(removed).catch(() => {
        /* storage cleanup is best-effort */
      });
    }
  };

  const setAsMain = (index: number) => {
    if (index === 0) return;
    const updated = [...allImages];
    const [newMain] = updated.splice(index, 1);
    onImagesChange(newMain, updated);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const updated = [...allImages];
    const [moved] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, moved);
    onImagesChange(updated[0] ?? null, updated.slice(1));
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleFileInput}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDraggingFiles(true); }}
        onDragLeave={() => setIsDraggingFiles(false)}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-all',
          isDraggingFiles ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
          allImages.length === 0 ? 'p-8' : 'p-4'
        )}
      >
        {allImages.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3">
            {isUploading ? (
              <>
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">جاري الرفع… {uploadProgress}%</p>
                <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">اسحب الصور هنا أو اضغط للرفع</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG — حتى {MAX_IMAGES} صور ({allImages.length}/{MAX_IMAGES})</p>
                </div>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="w-4 h-4 ml-2" />
                  اختيار صور
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={isUploading || allImages.length >= MAX_IMAGES} onClick={() => fileInputRef.current?.click()}>
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ImagePlus className="w-4 h-4 ml-2" />}
                {isUploading ? `${uploadProgress}%` : 'إضافة صور'}
              </Button>
              <p className="text-xs text-muted-foreground">اسحب لإعادة الترتيب · ★ للصورة الرئيسية</p>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="product-images" direction="horizontal">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-3">
                    {allImages.map((image, index) => (
                      <Draggable key={`${image}-${index}`} draggableId={`${image}-${index}`} index={index}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={cn(
                              'relative rounded-xl overflow-hidden border-2 bg-card group',
                              index === 0 ? 'border-primary w-full sm:w-48 aspect-square' : 'border-border w-24 h-24 sm:w-28 sm:h-28',
                              snapshot.isDragging && 'shadow-lg ring-2 ring-primary/30'
                            )}
                          >
                            <img src={image} alt="" className="w-full h-full object-cover" />
                            <div {...dragProvided.dragHandleProps} className="absolute top-1 right-1 p-1 rounded-md bg-card/90 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <div className="absolute top-1 left-1 flex gap-1">
                              {index !== 0 && (
                                <button type="button" onClick={() => setAsMain(index)} className="p-1.5 rounded-md bg-card/90 hover:bg-primary/10" aria-label="تعيين كرئيسية">
                                  <Star className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                              )}
                              <button type="button" onClick={() => removeImage(index)} className="p-1.5 rounded-md bg-card/90 hover:bg-destructive/10" aria-label="حذف">
                                <X className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>
                            {index === 0 && (
                              <div className="absolute bottom-0 inset-x-0 bg-primary text-primary-foreground text-[10px] font-bold text-center py-1">
                                الصورة الرئيسية
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    <button
                      type="button"
                      disabled={isUploading || allImages.length >= MAX_IMAGES}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <ImagePlus className="w-5 h-5 mb-1" />
                      <span className="text-[10px]">إضافة</span>
                    </button>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductImagesManager;
