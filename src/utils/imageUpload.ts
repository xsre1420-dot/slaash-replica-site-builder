
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'product-images';
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY = 0.82;
const THUMBNAIL_SIZE = 400;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

/** Windows/browsers sometimes send empty or non-standard MIME — infer from extension */
export const normalizeImageFile = (file: File): File => {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const inferred = EXT_TO_MIME[ext];
  const mime = (file.type || inferred || '').toLowerCase();

  if (!mime.startsWith('image/') && !inferred) {
    throw new Error('نوع الملف غير مدعوم. يرجى رفع صورة JPG أو PNG أو WebP');
  }

  const resolved = ALLOWED_MIME.has(mime)
    ? mime === 'image/jpg' || mime === 'image/pjpeg'
      ? 'image/jpeg'
      : mime === 'image/x-png'
        ? 'image/png'
        : mime
    : inferred === 'image/jpeg' || inferred === 'image/png' || inferred === 'image/webp' || inferred === 'image/gif'
      ? inferred
      : null;

  if (!resolved) {
    throw new Error('نوع الملف غير مدعوم. يرجى رفع صورة JPG أو PNG أو WebP');
  }

  if (file.type === resolved) return file;
  return new File([file], file.name, { type: resolved, lastModified: file.lastModified });
};

const mapStorageError = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('row-level security') || m.includes('policy') || m.includes('403')) {
    return 'ليس لديك صلاحية رفع الصورة — تأكد من تسجيل الدخول';
  }
  if (m.includes('bucket') && m.includes('not found')) {
    return 'مساحة التخزين غير مهيأة — تواصل مع الدعم';
  }
  if (m.includes('payload too large') || m.includes('entity too large')) {
    return 'حجم الصورة كبير جداً — الحد الأقصى 5MB';
  }
  return `فشل في رفع الصورة: ${message}`;
};

const compressImage = (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) resolve(jpegBlob);
                else reject(new Error('Image compression failed'));
              },
              'image/jpeg',
              quality
            );
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
};

const generateThumbnail = async (file: File): Promise<Blob> => {
  return compressImage(file, THUMBNAIL_SIZE, THUMBNAIL_SIZE, 0.7);
};

export const uploadImage = async (file: File, userId: string): Promise<string> => {
  const normalized = normalizeImageFile(file);

  if (normalized.size > 5 * 1024 * 1024) {
    throw new Error('حجم الصورة يجب أن لا يتجاوز 5MB');
  }

  let processedFile: Blob;
  try {
    processedFile = await compressImage(normalized, MAX_WIDTH, MAX_HEIGHT, QUALITY);
  } catch (err) {
    console.error('Image compression failed:', err);
    throw new Error('فشل في معالجة الصورة. يرجى اختيار ملف صورة صالح');
  }

  const ext = processedFile.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, processedFile, {
    cacheControl: '31536000',
    contentType: processedFile.type || 'image/jpeg',
    upsert: false,
  });

  if (error) {
    console.error('Image upload error:', error);
    throw new Error(mapStorageError(error.message));
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

  try {
    const thumbnail = await generateThumbnail(normalized);
    const thumbName = `${userId}/thumbs/${fileName.split('/').pop()}`;
    await supabase.storage.from(BUCKET).upload(thumbName, thumbnail, {
      cacheControl: '31536000',
      contentType: thumbnail.type || 'image/jpeg',
      upsert: false,
    });
  } catch (err) {
    console.warn('Thumbnail generation failed (non-critical):', err);
  }

  return urlData.publicUrl;
};

export const uploadImages = async (files: File[], userId: string): Promise<string[]> => {
  const results = await Promise.allSettled(files.map((file) => uploadImage(file, userId)));

  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map((r) => r.value);
};

export const isBlobUrl = (url: string): boolean => url.startsWith('blob:');

export const deleteImage = async (publicUrl: string): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      throw new Error('يجب تسجيل الدخول لحذف الصورة');
    }

    const url = new URL(publicUrl);
    const pathParts = url.pathname.split(`/object/public/${BUCKET}/`);
    if (pathParts.length < 2) return;

    const filePath = decodeURIComponent(pathParts[1]);
    const pathOwnerId = filePath.split('/')[0];

    if (pathOwnerId !== userId) {
      throw new Error('غير مصرح بحذف هذه الصورة');
    }

    const thumbPath = filePath.replace(/^([^/]+)\//, '$1/thumbs/');

    await Promise.allSettled([
      supabase.storage.from(BUCKET).remove([filePath]),
      supabase.storage.from(BUCKET).remove([thumbPath]),
    ]);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};
