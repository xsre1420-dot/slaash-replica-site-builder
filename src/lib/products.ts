
import { supabase } from "@/integrations/supabase/client";

export interface DatabaseProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  additional_images?: string[];
  owner_id: string;
  created_at: string;
  updated_at: string;
}

// Helper function to set owner context
const setOwnerContext = async (ownerId: string) => {
  try {
    // Store owner context for RLS policies
    localStorage.setItem('current_owner_id', ownerId);
    
    // Verify owner exists
    const { error } = await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('id', ownerId)
      .single();
      
    if (error) {
      console.error('Owner verification failed:', error);
    }
  } catch (error) {
    console.error('Error setting owner context:', error);
  }
};

export const saveProduct = async (productData: {
  name: string;
  description: string;
  category: string;
  price: number;
  image: string;
  additionalImages?: string[];
  ownerId: string;
}) => {
  try {
    // Set owner context for RLS
    await setOwnerContext(productData.ownerId);
    
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: productData.name,
        description: productData.description,
        category: productData.category,
        price: productData.price,
        image_url: productData.image,
        additional_images: productData.additionalImages || [],
        owner_id: productData.ownerId
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving product:', error);
      return { error: 'حدث خطأ أثناء حفظ المنتج' };
    }

    return { data };
  } catch (error) {
    console.error('Error saving product:', error);
    return { error: 'حدث خطأ أثناء حفظ المنتج' };
  }
};

export const getProducts = async (ownerId: string) => {
  try {
    // Set owner context for RLS
    await setOwnerContext(ownerId);
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      return { error: 'حدث خطأ أثناء جلب المنتجات' };
    }

    return { data };
  } catch (error) {
    console.error('Error fetching products:', error);
    return { error: 'حدث خطأ أثناء جلب المنتجات' };
  }
};

export const updateProduct = async (
  productId: string,
  ownerId: string,
  productData: {
    name: string;
    description: string;
    category: string;
    price: number;
    image_url: string;
    additional_images?: string[];
  }
) => {
  try {
    // Set owner context for RLS
    await setOwnerContext(ownerId);
    
    const { data, error } = await supabase
      .from('products')
      .update({
        ...productData,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return { error: 'حدث خطأ أثناء تحديث المنتج' };
    }

    return { data };
  } catch (error) {
    console.error('Error updating product:', error);
    return { error: 'حدث خطأ أثناء تحديث المنتج' };
  }
};

export const deleteProduct = async (productId: string, ownerId: string) => {
  try {
    // Set owner context for RLS
    await setOwnerContext(ownerId);
    
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Error deleting product:', error);
      return { error: 'حدث خطأ أثناء حذف المنتج' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    return { error: 'حدث خطأ أثناء حذف المنتج' };
  }
};
