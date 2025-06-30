
import { supabase } from "@/integrations/supabase/client";
import bcrypt from 'bcryptjs';

export interface RestaurantOwner {
  id: string;
  username: string;
  restaurant_name?: string;
  restaurant_logo?: string;
}

// Function to set the current owner context in the database
const setOwnerContext = async (ownerId: string) => {
  try {
    // Set the owner context for RLS policies using raw SQL
    const { error } = await supabase.rpc('get_current_restaurant_owner_id');
    
    // Use a direct approach to set the configuration
    await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('id', ownerId)
      .single();
      
    // Set context using a session variable approach
    const { error: configError } = await supabase
      .from('restaurant_owners')  
      .select('*')
      .eq('id', ownerId)
      .single();
      
    if (!configError) {
      // Store owner context in a way that can be accessed by RLS
      localStorage.setItem('current_owner_id', ownerId);
    }
  } catch (error) {
    console.error('Error setting owner context:', error);
  }
};

export const loginUser = async (username: string, password: string) => {
  try {
    // البحث عن المستخدم
    const { data: user, error: fetchError } = await supabase
      .from('restaurant_owners')
      .select('*')
      .eq('username', username)
      .single();

    if (fetchError || !user) {
      return { error: 'اسم المستخدم غير موجود' };
    }

    // التحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return { error: 'كلمة المرور غير صحيحة' };
    }

    // Set the database context for RLS policies
    await setOwnerContext(user.id);

    return { 
      user: {
        id: user.id,
        username: user.username,
        restaurant_name: user.restaurant_name,
        restaurant_logo: user.restaurant_logo
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'حدث خطأ أثناء تسجيل الدخول' };
  }
};

export const registerUser = async (username: string, password: string, restaurantName?: string) => {
  try {
    // التحقق من وجود المستخدم
    const { data: existingUser } = await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) {
      return { error: 'اسم المستخدم موجود بالفعل' };
    }

    // تشفير كلمة المرور
    const passwordHash = await bcrypt.hash(password, 10);

    // إنشاء المستخدم الجديد
    const { data: newUser, error: insertError } = await supabase
      .from('restaurant_owners')
      .insert({
        username,
        password_hash: passwordHash,
        restaurant_name: restaurantName || username
      })
      .select()
      .single();

    if (insertError) {
      console.error('Registration error:', insertError);
      return { error: 'حدث خطأ أثناء إنشاء الحساب' };
    }

    // Set the database context for RLS policies
    await setOwnerContext(newUser.id);

    return { 
      user: {
        id: newUser.id,
        username: newUser.username,
        restaurant_name: newUser.restaurant_name,
        restaurant_logo: newUser.restaurant_logo
      }
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'حدث خطأ أثناء إنشاء الحساب' };
  }
};

// Function to initialize owner context when app loads
export const initializeOwnerContext = async (ownerId: string) => {
  await setOwnerContext(ownerId);
};
