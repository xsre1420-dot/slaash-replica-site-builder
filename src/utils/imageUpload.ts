
import { supabase } from "@/integrations/supabase/client";

const BUCKET = 'product-images';

/**
 * Upload an image file to Supabase Storage
 * Returns the public URL of the uploaded image
 */
export const uploadImage = async (file: File, userId: string): Promise<string> => {
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;
  
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, {
      cacheControl: '31536000', // 1 year cache
      upsert: false,
    });

  if (error) {
    console.error('Image upload error:', error);
    throw new Error('فشل في رفع الصورة');
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

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
 * Delete an image from Supabase Storage
 */
export const deleteImage = async (publicUrl: string): Promise<void> => {
  try {
    // Extract path from public URL
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split(`/object/public/${BUCKET}/`);
    if (pathParts.length < 2) return;
    
    const filePath = pathParts[1];
    await supabase.storage.from(BUCKET).remove([filePath]);
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};
