
import { supabase } from "@/integrations/supabase/client";

const BUCKET = 'product-images';
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY = 0.82;
const THUMBNAIL_SIZE = 400;

/**
 * Compress and optionally convert an image to WebP using Canvas API
 */
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
      
      // Scale down if needed
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
      
      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Try WebP first, fallback to JPEG
      const mimeType = 'image/webp';
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Fallback to JPEG if WebP not supported
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
        mimeType,
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

/**
 * Generate a thumbnail from a file
 */
const generateThumbnail = async (file: File): Promise<Blob> => {
  return compressImage(file, THUMBNAIL_SIZE, THUMBNAIL_SIZE, 0.7);
};

/**
 * Upload an image file to Supabase Storage with compression
 * Returns the public URL of the uploaded image
 */
export const uploadImage = async (file: File, userId: string): Promise<string> => {
  // Compress the image before uploading
  let processedFile: Blob;
  try {
    processedFile = await compressImage(file, MAX_WIDTH, MAX_HEIGHT, QUALITY);
    console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(processedFile.size / 1024).toFixed(0)}KB`);
  } catch (err) {
    console.warn('Image compression failed, uploading original:', err);
    processedFile = file;
  }

  const ext = processedFile.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;
  
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, processedFile, {
      cacheControl: '31536000', // 1 year cache
      contentType: processedFile.type,
      upsert: false,
    });

  if (error) {
    console.error('Image upload error:', error);
    throw new Error('فشل في رفع الصورة');
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  // Also generate and upload thumbnail
  try {
    const thumbnail = await generateThumbnail(file);
    const thumbName = `${userId}/thumbs/${fileName.split('/').pop()}`;
    await supabase.storage.from(BUCKET).upload(thumbName, thumbnail, {
      cacheControl: '31536000',
      contentType: thumbnail.type,
      upsert: false,
    });
  } catch (err) {
    console.warn('Thumbnail generation failed (non-critical):', err);
  }

  return urlData.publicUrl;
};

/**
 * Upload multiple images concurrently
 */
export const uploadImages = async (files: File[], userId: string): Promise<string[]> => {
  const results = await Promise.allSettled(
    files.map(file => uploadImage(file, userId))
  );
  
  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map(r => r.value);
};

/**
 * Check if a URL is a blob URL (temporary, won't persist)
 */
export const isBlobUrl = (url: string): boolean => {
  return url.startsWith('blob:');
};

/**
 * Delete an image from Supabase Storage (including thumbnail)
 */
export const deleteImage = async (publicUrl: string): Promise<void> => {
  try {
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split(`/object/public/${BUCKET}/`);
    if (pathParts.length < 2) return;
    
    const filePath = pathParts[1];
    const thumbPath = filePath.replace(/^([^/]+)\//, '$1/thumbs/');
    
    // Delete both original and thumbnail
    await Promise.allSettled([
      supabase.storage.from(BUCKET).remove([filePath]),
      supabase.storage.from(BUCKET).remove([thumbPath]),
    ]);
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};
